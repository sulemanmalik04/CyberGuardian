import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const s3 = new AWS.S3();
const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'cyberaware-assets';

interface UploadFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

class S3Service {
  async uploadFile(file: UploadFile, folder: string = 'uploads'): Promise<string> {
    try {
      const fileExtension = path.extname(file.originalname);
      const fileName = `${folder}/${uuidv4()}${fileExtension}`;

      const uploadParams: AWS.S3.PutObjectRequest = {
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read'
      };

      const result = await s3.upload(uploadParams).promise();
      return result.Location;
    } catch (error) {
      throw new Error(`S3 upload failed: ${error.message}`);
    }
  }

  async uploadLogo(file: UploadFile, clientId: string): Promise<string> {
    try {
      const fileExtension = path.extname(file.originalname);
      const fileName = `logos/${clientId}/${uuidv4()}${fileExtension}`;

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
      if (!allowedTypes.includes(file.mimetype)) {
        throw new Error('Invalid file type. Only JPEG, PNG, SVG, and WebP are allowed.');
      }

      // Validate file size (max 2MB)
      if (file.buffer.length > 2 * 1024 * 1024) {
        throw new Error('File size too large. Maximum size is 2MB.');
      }

      const uploadParams: AWS.S3.PutObjectRequest = {
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read',
        Metadata: {
          'client-id': clientId,
          'file-type': 'logo'
        }
      };

      const result = await s3.upload(uploadParams).promise();
      return result.Location;
    } catch (error) {
      throw new Error(`Logo upload failed: ${error.message}`);
    }
  }

  async uploadCourseContent(file: UploadFile, courseId: string): Promise<string> {
    try {
      const fileExtension = path.extname(file.originalname);
      const fileName = `courses/${courseId}/${uuidv4()}${fileExtension}`;

      // Validate file types for course content
      const allowedTypes = [
        'video/mp4', 'video/webm', 'video/ogg',
        'application/pdf',
        'image/jpeg', 'image/png', 'image/svg+xml',
        'audio/mpeg', 'audio/wav'
      ];
      
      if (!allowedTypes.includes(file.mimetype)) {
        throw new Error('Invalid file type for course content.');
      }

      // Validate file size (max 100MB for videos, 10MB for others)
      const maxSize = file.mimetype.startsWith('video/') ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
      if (file.buffer.length > maxSize) {
        throw new Error(`File size too large. Maximum size is ${maxSize / (1024 * 1024)}MB.`);
      }

      const uploadParams: AWS.S3.PutObjectRequest = {
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read',
        Metadata: {
          'course-id': courseId,
          'file-type': 'course-content'
        }
      };

      const result = await s3.upload(uploadParams).promise();
      return result.Location;
    } catch (error) {
      throw new Error(`Course content upload failed: ${error.message}`);
    }
  }

  async generatePresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const params = {
        Bucket: BUCKET_NAME,
        Key: key,
        Expires: expiresIn
      };

      return s3.getSignedUrl('getObject', params);
    } catch (error) {
      throw new Error(`Presigned URL generation failed: ${error.message}`);
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const params = {
        Bucket: BUCKET_NAME,
        Key: key
      };

      await s3.deleteObject(params).promise();
    } catch (error) {
      throw new Error(`File deletion failed: ${error.message}`);
    }
  }

  async listFiles(folder: string): Promise<string[]> {
    try {
      const params = {
        Bucket: BUCKET_NAME,
        Prefix: folder + '/'
      };

      const result = await s3.listObjectsV2(params).promise();
      return result.Contents?.map(obj => obj.Key!) || [];
    } catch (error) {
      throw new Error(`File listing failed: ${error.message}`);
    }
  }

  async copyFile(sourceKey: string, destKey: string): Promise<string> {
    try {
      const copyParams = {
        Bucket: BUCKET_NAME,
        CopySource: `${BUCKET_NAME}/${sourceKey}`,
        Key: destKey,
        ACL: 'public-read'
      };

      const result = await s3.copyObject(copyParams).promise();
      return `https://${BUCKET_NAME}.s3.amazonaws.com/${destKey}`;
    } catch (error) {
      throw new Error(`File copy failed: ${error.message}`);
    }
  }
}

export const s3Service = new S3Service();
