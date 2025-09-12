import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'cyberaware-platform-assets';
const isDevelopment = process.env.NODE_ENV === 'development';

// Configure AWS only if credentials are available
let s3: AWS.S3 | null = null;

if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY) {
  AWS.config.update({
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
    region: AWS_REGION
  });
  s3 = new AWS.S3({
    signatureVersion: 'v4',
    region: AWS_REGION
  });
} else if (!isDevelopment) {
  throw new Error("AWS credentials must be set in production");
}

// File type configurations
const FILE_TYPE_CONFIGS = {
  logo: {
    allowedTypes: ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'],
    maxSize: 2 * 1024 * 1024, // 2MB
    folder: 'logos'
  },
  courseContent: {
    allowedTypes: [
      'video/mp4', 'video/webm', 'video/ogg',
      'application/pdf',
      'image/jpeg', 'image/png', 'image/svg+xml',
      'audio/mpeg', 'audio/wav', 'audio/mp3'
    ],
    maxSize: 100 * 1024 * 1024, // 100MB
    folder: 'courses'
  },
  avatar: {
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxSize: 1 * 1024 * 1024, // 1MB
    folder: 'avatars'
  },
  document: {
    allowedTypes: ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    maxSize: 10 * 1024 * 1024, // 10MB
    folder: 'documents'
  }
};

interface UploadFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

interface UploadOptions {
  clientId: string;
  fileType: keyof typeof FILE_TYPE_CONFIGS;
  isPublic?: boolean;
  metadata?: Record<string, string>;
}

interface PresignedUrlOptions {
  operation: 'getObject' | 'putObject';
  expiresIn?: number;
  contentType?: string;
  clientId: string; // SECURITY: Required for tenant isolation
}

interface PostPolicyOptions {
  clientId: string;
  fileType: keyof typeof FILE_TYPE_CONFIGS;
  contentType: string;
  maxSizeBytes?: number;
  expiresIn?: number;
  metadata?: Record<string, string>;
}

interface PostPolicyResult {
  url: string;
  key: string;
  fields: Record<string, string>;
  conditions: Array<any>;
}

class S3Service {
  private validateFile(file: UploadFile, fileType: keyof typeof FILE_TYPE_CONFIGS): void {
    const config = FILE_TYPE_CONFIGS[fileType];
    
    if (!config.allowedTypes.includes(file.mimetype)) {
      throw new Error(`Invalid file type for ${fileType}. Allowed types: ${config.allowedTypes.join(', ')}`);
    }

    if (file.buffer.length > config.maxSize) {
      const maxSizeMB = config.maxSize / (1024 * 1024);
      throw new Error(`File size too large for ${fileType}. Maximum size is ${maxSizeMB}MB.`);
    }
  }

  private generateTenantKey(clientId: string, fileType: keyof typeof FILE_TYPE_CONFIGS, fileName: string): string {
    const config = FILE_TYPE_CONFIGS[fileType];
    return `tenants/${clientId}/${config.folder}/${fileName}`;
  }

  async uploadFile(file: UploadFile, options: UploadOptions): Promise<{ url: string; key: string }> {
    if (!s3) {
      throw new Error('AWS S3 not configured. Please set AWS credentials.');
    }
    
    try {
      this.validateFile(file, options.fileType);
      
      const fileExtension = path.extname(file.originalname);
      const fileName = `${uuidv4()}${fileExtension}`;
      const key = this.generateTenantKey(options.clientId, options.fileType, fileName);

      const uploadParams: AWS.S3.PutObjectRequest = {
        Bucket: BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ServerSideEncryption: 'AES256', // SECURITY: Force server-side encryption
        Metadata: {
          'client-id': options.clientId,
          'file-type': options.fileType,
          'original-name': file.originalname,
          ...options.metadata
        }
      };

      // Only set ACL if explicitly public, otherwise use bucket default (private)
      if (options.isPublic) {
        uploadParams.ACL = 'public-read';
      }

      const result = await s3.upload(uploadParams).promise();
      
      return {
        url: result.Location,
        key
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`S3 upload failed: ${errorMessage}`);
    }
  }

  async uploadLogo(file: UploadFile, clientId: string): Promise<string> {
    const result = await this.uploadFile(file, {
      clientId,
      fileType: 'logo',
      isPublic: true,
      metadata: {
        'usage': 'client-branding'
      }
    });
    return result.url;
  }

  async uploadCourseContent(file: UploadFile, clientId: string, courseId: string): Promise<string> {
    const result = await this.uploadFile(file, {
      clientId,
      fileType: 'courseContent',
      isPublic: false, // Course content should be private by default
      metadata: {
        'course-id': courseId,
        'usage': 'course-material'
      }
    });
    return result.url;
  }

  async uploadUserAvatar(file: UploadFile, clientId: string, userId: string): Promise<string> {
    const result = await this.uploadFile(file, {
      clientId,
      fileType: 'avatar',
      isPublic: true,
      metadata: {
        'user-id': userId,
        'usage': 'profile-picture'
      }
    });
    return result.url;
  }

  async uploadDocument(file: UploadFile, clientId: string, documentType?: string): Promise<string> {
    const result = await this.uploadFile(file, {
      clientId,
      fileType: 'document',
      isPublic: false,
      metadata: {
        'document-type': documentType || 'general',
        'usage': 'document-storage'
      }
    });
    return result.url;
  }

  async generatePresignedUrl(
    key: string, 
    options: PresignedUrlOptions // SECURITY: clientId now required
  ): Promise<string> {
    if (!s3) {
      throw new Error('AWS S3 not configured. Please set AWS credentials.');
    }

    // SECURITY: Enforce tenant isolation - verify key belongs to clientId
    if (!this.verifyClientAccess(key, options.clientId)) {
      throw new Error('Access denied: File does not belong to this client');
    }
    
    try {
      const params: any = {
        Bucket: BUCKET_NAME,
        Key: key,
        Expires: options.expiresIn || 3600 // 1 hour default
      };

      if (options.operation === 'putObject') {
        if (options.contentType) {
          params.ContentType = options.contentType;
        }
        // SECURITY: Force server-side encryption on uploads
        params.ServerSideEncryption = 'AES256';
      }

      return s3.getSignedUrl(options.operation, params);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Presigned URL generation failed: ${errorMessage}`);
    }
  }

  // SECURITY: Deprecated in favor of generatePostPolicy for better security
  // @deprecated Use generatePostPolicy() instead for better upload security
  async generatePresignedUploadUrl(
    clientId: string, 
    fileType: keyof typeof FILE_TYPE_CONFIGS,
    contentType: string,
    expiresIn: number = 3600
  ): Promise<{ url: string; key: string }> {
    console.warn('⚠️  generatePresignedUploadUrl is deprecated. Use generatePostPolicy for better security.');
    
    if (!s3) {
      throw new Error('AWS S3 not configured. Please set AWS credentials.');
    }

    const config = FILE_TYPE_CONFIGS[fileType];
    if (!config.allowedTypes.includes(contentType)) {
      throw new Error(`Invalid content type for ${fileType}. Allowed types: ${config.allowedTypes.join(', ')}`);
    }

    const fileName = `${uuidv4()}.${contentType.split('/')[1]}`;
    const key = this.generateTenantKey(clientId, fileType, fileName);

    const url = await this.generatePresignedUrl(key, {
      operation: 'putObject',
      expiresIn,
      contentType,
      clientId // SECURITY: Pass clientId for verification
    });

    return { url, key };
  }

  // SECURITY: New secure method using POST policies with content-length-range limits
  async generatePostPolicy(options: PostPolicyOptions): Promise<PostPolicyResult> {
    if (!s3) {
      throw new Error('AWS S3 not configured. Please set AWS credentials.');
    }

    const config = FILE_TYPE_CONFIGS[options.fileType];
    if (!config.allowedTypes.includes(options.contentType)) {
      throw new Error(`Invalid content type for ${options.fileType}. Allowed types: ${config.allowedTypes.join(', ')}`);
    }

    // Generate secure filename and key
    const fileName = `${uuidv4()}.${options.contentType.split('/')[1]}`;
    const key = this.generateTenantKey(options.clientId, options.fileType, fileName);

    // Calculate expiration (default 1 hour)
    const expiresIn = options.expiresIn || 3600;
    const expirationDate = new Date();
    expirationDate.setSeconds(expirationDate.getSeconds() + expiresIn);

    // Use provided max size or config default
    const maxSize = options.maxSizeBytes || config.maxSize;

    try {
      // SECURITY: Create POST policy with strict conditions
      const policyDocument = {
        expiration: expirationDate.toISOString(),
        conditions: [
          { bucket: BUCKET_NAME },
          { key },
          { 'Content-Type': options.contentType },
          // SECURITY: Enforce file size limits to prevent DoS/cost attacks
          ['content-length-range', 1, maxSize],
          // SECURITY: Force server-side encryption
          { 'x-amz-server-side-encryption': 'AES256' },
          // SECURITY: Add client metadata for audit trails
          { 'x-amz-meta-client-id': options.clientId },
          { 'x-amz-meta-file-type': options.fileType }
        ]
      };

      // Add optional metadata conditions
      if (options.metadata) {
        Object.entries(options.metadata).forEach(([metaKey, value]) => {
          (policyDocument.conditions as any[]).push({ [`x-amz-meta-${metaKey}`]: value });
        });
      }

      // Create policy document and sign it
      const policyString = JSON.stringify(policyDocument);
      const policyBase64 = Buffer.from(policyString).toString('base64');

      // Create AWS Signature V4
      const dateString = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const credential = `${AWS_ACCESS_KEY_ID}/${dateString}/${AWS_REGION}/s3/aws4_request`;

      // Prepare form fields for POST request
      const fields: Record<string, string> = {
        key,
        'Content-Type': options.contentType,
        'x-amz-server-side-encryption': 'AES256',
        'x-amz-meta-client-id': options.clientId,
        'x-amz-meta-file-type': options.fileType,
        policy: policyBase64,
        'x-amz-algorithm': 'AWS4-HMAC-SHA256',
        'x-amz-credential': credential,
        'x-amz-date': new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
      };

      // Add optional metadata fields
      if (options.metadata) {
        Object.entries(options.metadata).forEach(([metaKey, value]) => {
          fields[`x-amz-meta-${metaKey}`] = value;
        });
      }

      // Create signature using crypto
      const crypto = require('crypto');
      const signingKey = this.getSigningKey(dateString, AWS_SECRET_ACCESS_KEY!, AWS_REGION, 's3');
      const signature = crypto.createHmac('sha256', signingKey).update(policyBase64).digest('hex');
      fields['x-amz-signature'] = signature;

      return {
        url: `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/`,
        key,
        fields,
        conditions: policyDocument.conditions
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`POST policy generation failed: ${errorMessage}`);
    }
  }

  // Helper method for AWS Signature V4
  private getSigningKey(dateString: string, secretAccessKey: string, region: string, service: string): Buffer {
    const crypto = require('crypto');
    const kDate = crypto.createHmac('sha256', 'AWS4' + secretAccessKey).update(dateString).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    return crypto.createHmac('sha256', kService).update('aws4_request').digest();
  }

  async deleteFile(key: string, clientId: string): Promise<void> {
    if (!s3) {
      throw new Error('AWS S3 not configured. Please set AWS credentials.');
    }
    
    try {
      // SECURITY: Ensure the key belongs to the client
      if (!this.verifyClientAccess(key, clientId)) {
        throw new Error('Access denied: File does not belong to this client');
      }

      const params = {
        Bucket: BUCKET_NAME,
        Key: key
      };

      await s3.deleteObject(params).promise();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`File deletion failed: ${errorMessage}`);
    }
  }

  async listFiles(clientId: string, fileType?: keyof typeof FILE_TYPE_CONFIGS): Promise<Array<{
    key: string;
    size: number;
    lastModified: Date;
    contentType?: string;
    metadata?: Record<string, string>;
  }>> {
    if (!s3) {
      throw new Error('AWS S3 not configured. Please set AWS credentials.');
    }
    
    try {
      const prefix = fileType 
        ? `tenants/${clientId}/${FILE_TYPE_CONFIGS[fileType].folder}/`
        : `tenants/${clientId}/`;

      const params = {
        Bucket: BUCKET_NAME,
        Prefix: prefix
      };

      const result = await s3.listObjectsV2(params).promise();
      
      if (!result.Contents) {
        return [];
      }

      // Get detailed metadata for each file
      const filesWithMetadata = await Promise.all(
        result.Contents.map(async (obj) => {
          try {
            const headResult = await s3.headObject({
              Bucket: BUCKET_NAME,
              Key: obj.Key!
            }).promise();
            
            return {
              key: obj.Key!,
              size: obj.Size || 0,
              lastModified: obj.LastModified || new Date(),
              contentType: headResult.ContentType,
              metadata: headResult.Metadata
            };
          } catch {
            // If head request fails, return basic info
            return {
              key: obj.Key!,
              size: obj.Size || 0,
              lastModified: obj.LastModified || new Date()
            };
          }
        })
      );

      return filesWithMetadata;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`File listing failed: ${errorMessage}`);
    }
  }

  async copyFile(
    sourceKey: string, 
    destKey: string, 
    sourceClientId: string,
    destClientId: string
  ): Promise<string> {
    if (!s3) {
      throw new Error('AWS S3 not configured. Please set AWS credentials.');
    }
    
    try {
      // SECURITY: Verify access to both source and destination
      if (!this.verifyClientAccess(sourceKey, sourceClientId)) {
        throw new Error('Access denied: Source file does not belong to this client');
      }
      if (!this.verifyClientAccess(destKey, destClientId)) {
        throw new Error('Access denied: Destination path does not belong to this client');
      }

      const copyParams = {
        Bucket: BUCKET_NAME,
        CopySource: `${BUCKET_NAME}/${sourceKey}`,
        Key: destKey,
        ServerSideEncryption: 'AES256', // SECURITY: Ensure copied files are encrypted
        MetadataDirective: 'REPLACE' as const,
        Metadata: {
          'client-id': destClientId,
          'copied-from': sourceKey,
          'copied-at': new Date().toISOString()
        }
      };

      await s3.copyObject(copyParams).promise();
      
      // Generate a presigned URL for the copied file
      return this.generatePresignedUrl(destKey, { 
        operation: 'getObject', 
        expiresIn: 3600,
        clientId: destClientId 
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`File copy failed: ${errorMessage}`);
    }
  }

  // Utility method to extract client ID from a file key
  extractClientIdFromKey(key: string): string | null {
    const match = key.match(/^tenants\/([^/]+)\//);;
    return match ? match[1] : null;
  }

  // Method to verify client has access to a file
  verifyClientAccess(key: string, clientId: string): boolean {
    const extractedClientId = this.extractClientIdFromKey(key);
    const hasAccess = extractedClientId === clientId;
    
    if (!hasAccess) {
      console.warn(`🚨 SECURITY: Access denied - Client ${clientId} attempted to access file belonging to ${extractedClientId}: ${key}`);
    }
    
    return hasAccess;
  }

  // SECURITY: Method to validate upload requests before generating policies
  async validateUploadRequest(
    clientId: string,
    fileType: keyof typeof FILE_TYPE_CONFIGS,
    contentType: string,
    fileSize: number
  ): Promise<{ valid: boolean; error?: string }> {
    const config = FILE_TYPE_CONFIGS[fileType];
    
    // Check file type
    if (!config.allowedTypes.includes(contentType)) {
      return {
        valid: false,
        error: `Invalid content type for ${fileType}. Allowed: ${config.allowedTypes.join(', ')}`
      };
    }
    
    // Check file size
    if (fileSize > config.maxSize) {
      const maxSizeMB = config.maxSize / (1024 * 1024);
      return {
        valid: false,
        error: `File size ${Math.round(fileSize / 1024 / 1024)}MB exceeds limit of ${maxSizeMB}MB for ${fileType}`
      };
    }
    
    // Additional security checks could be added here
    // - Client quota checks
    // - File type analysis beyond MIME
    // - Rate limiting per client
    
    return { valid: true };
  }

  // Bulk delete files for a client (useful for cleanup)
  async deleteClientFiles(clientId: string, fileType?: keyof typeof FILE_TYPE_CONFIGS): Promise<void> {
    if (!s3) {
      throw new Error('AWS S3 not configured. Please set AWS credentials.');
    }

    try {
      const files = await this.listFiles(clientId, fileType);
      
      if (files.length === 0) {
        return;
      }

      // Delete in batches of 1000 (AWS limit)
      const batchSize = 1000;
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        const deleteParams = {
          Bucket: BUCKET_NAME,
          Delete: {
            Objects: batch.map(file => ({ Key: file.key }))
          }
        };
        
        await s3.deleteObjects(deleteParams).promise();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Bulk file deletion failed: ${errorMessage}`);
    }
  }
}

export const s3Service = new S3Service();
