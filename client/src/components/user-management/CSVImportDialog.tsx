import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Download,
  Users,
  Eye,
  FileCheck,
  Loader2
} from 'lucide-react';

interface CSVImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PreviewData {
  success: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: string[];
  warnings: string[];
  preview: any[];
  sampleHeaders: string[];
  truncated: boolean;
}

interface ImportResult {
  success: boolean;
  totalProcessed: number;
  created: number;
  validRows: number;
  errors: string[];
  warnings: string[];
  createdUsers: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    tempPassword: string;
  }>;
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'complete';

export default function CSVImportDialog({ isOpen, onClose }: CSVImportDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const previewMutation = useMutation({
    mutationFn: api.previewUsersFromCSV,
    onSuccess: (data: PreviewData) => {
      setPreviewData(data);
      setCurrentStep('preview');
    },
    onError: (error: any) => {
      toast({
        title: 'Preview Failed',
        description: error.message || 'Failed to preview CSV file',
        variant: 'destructive'
      });
      setCurrentStep('upload');
    }
  });

  const importMutation = useMutation({
    mutationFn: api.importUsersFromCSV,
    onSuccess: (data: ImportResult) => {
      setImportResult(data);
      setCurrentStep('complete');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      
      toast({
        title: 'Import Complete',
        description: `Successfully imported ${data.created} users${data.errors.length > 0 ? ` with ${data.errors.length} errors` : ''}`,
        variant: data.errors.length > 0 ? 'destructive' : 'default'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Import Failed',
        description: error.message || 'Failed to import CSV file',
        variant: 'destructive'
      });
      setCurrentStep('preview');
    }
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Basic client-side validation
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File Too Large',
          description: 'File size must be less than 5MB',
          variant: 'destructive'
        });
        return;
      }

      const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
      if (!allowedTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.csv')) {
        toast({
          title: 'Invalid File Type',
          description: 'Please select a CSV file',
          variant: 'destructive'
        });
        return;
      }

      setSelectedFile(file);
      previewMutation.mutate(file);
    }
  };

  const handleImportConfirm = () => {
    if (selectedFile) {
      setCurrentStep('importing');
      importMutation.mutate(selectedFile);
    }
  };

  const handleReset = () => {
    setCurrentStep('upload');
    setSelectedFile(null);
    setPreviewData(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const renderUploadStep = () => (
    <div className="space-y-6">
      <div 
        className="border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => fileInputRef.current?.click()}
        data-testid="csv-upload-zone"
      >
        <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <div className="space-y-2">
          <h3 className="text-lg font-medium">Upload CSV File</h3>
          <p className="text-muted-foreground">
            Drag & drop your CSV file here, or click to browse
          </p>
          <div className="flex justify-center">
            <Button 
              variant="outline" 
              disabled={previewMutation.isPending}
              data-testid="button-browse-csv"
            >
              {previewMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              {previewMutation.isPending ? 'Processing...' : 'Choose File'}
            </Button>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileSelect}
        data-testid="input-csv-file"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">CSV Format Requirements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm">
            <p className="font-medium text-green-600 mb-2">Required columns:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>email - Valid email address</li>
              <li>firstName - User's first name</li>
              <li>lastName - User's last name</li>
            </ul>
          </div>
          <div className="text-sm">
            <p className="font-medium text-blue-600 mb-2">Optional columns:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>department - User's department</li>
              <li>role - User role (end_user, client_admin, super_admin)</li>
              <li>language - Language preference (en, es, fr, de, it)</li>
            </ul>
          </div>
          <div className="text-xs text-muted-foreground pt-2 border-t">
            File size limit: 5MB • Supported format: CSV
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderPreviewStep = () => {
    if (!previewData) return null;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{previewData.totalRows}</p>
                  <p className="text-sm text-muted-foreground">Total Rows</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-green-600">{previewData.validRows}</p>
                  <p className="text-sm text-muted-foreground">Valid Rows</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <XCircle className="w-5 h-5 text-red-600" />
                <div>
                  <p className="text-2xl font-bold text-red-600">{previewData.invalidRows}</p>
                  <p className="text-sm text-muted-foreground">Invalid Rows</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {previewData.errors.length > 0 && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Validation Errors ({previewData.errors.length})</AlertTitle>
            <AlertDescription className="mt-2">
              <div className="max-h-32 overflow-y-auto space-y-1">
                {previewData.errors.slice(0, 10).map((error, index) => (
                  <div key={index} className="text-sm">{error}</div>
                ))}
                {previewData.errors.length > 10 && (
                  <div className="text-sm font-medium">
                    ... and {previewData.errors.length - 10} more errors
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {previewData.warnings.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Warnings ({previewData.warnings.length})</AlertTitle>
            <AlertDescription className="mt-2">
              <div className="max-h-32 overflow-y-auto space-y-1">
                {previewData.warnings.slice(0, 5).map((warning, index) => (
                  <div key={index} className="text-sm">{warning}</div>
                ))}
                {previewData.warnings.length > 5 && (
                  <div className="text-sm font-medium">
                    ... and {previewData.warnings.length - 5} more warnings
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {previewData.preview.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center">
                <Eye className="w-4 h-4 mr-2" />
                Data Preview (First 10 valid rows)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2 font-medium">Email</th>
                      <th className="text-left p-2 font-medium">First Name</th>
                      <th className="text-left p-2 font-medium">Last Name</th>
                      <th className="text-left p-2 font-medium">Department</th>
                      <th className="text-left p-2 font-medium">Role</th>
                      <th className="text-left p-2 font-medium">Language</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.preview.map((row, index) => (
                      <tr key={index} className="border-t">
                        <td className="p-2">{row.email}</td>
                        <td className="p-2">{row.firstName}</td>
                        <td className="p-2">{row.lastName}</td>
                        <td className="p-2">{row.department || 'N/A'}</td>
                        <td className="p-2">
                          <Badge variant="outline">{row.role}</Badge>
                        </td>
                        <td className="p-2">{row.language}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {previewData.truncated && (
                <div className="text-xs text-muted-foreground mt-2">
                  Preview limited to first 1000 rows
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderImportingStep = () => (
    <div className="space-y-6 text-center">
      <div className="space-y-4">
        <Loader2 className="w-16 h-16 text-primary mx-auto animate-spin" />
        <div>
          <h3 className="text-lg font-medium">Importing Users...</h3>
          <p className="text-muted-foreground">
            Please wait while we import your users. This may take a few moments.
          </p>
        </div>
      </div>
      <Progress value={50} className="w-full" />
    </div>
  );

  const renderCompleteStep = () => {
    if (!importResult) return null;

    return (
      <div className="space-y-6">
        <div className="text-center space-y-4">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto" />
          <div>
            <h3 className="text-lg font-medium text-green-600">Import Complete!</h3>
            <p className="text-muted-foreground">
              Successfully imported {importResult.created} out of {importResult.totalProcessed} users
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-green-600">{importResult.created}</p>
                  <p className="text-sm text-muted-foreground">Users Created</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <XCircle className="w-5 h-5 text-red-600" />
                <div>
                  <p className="text-2xl font-bold text-red-600">{importResult.errors.length}</p>
                  <p className="text-sm text-muted-foreground">Errors</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {importResult.createdUsers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Created Users & Temporary Passwords</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Important</AlertTitle>
                  <AlertDescription>
                    Save these temporary passwords. Users should change them on first login.
                  </AlertDescription>
                </Alert>
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left p-2 font-medium">Email</th>
                        <th className="text-left p-2 font-medium">Name</th>
                        <th className="text-left p-2 font-medium">Temp Password</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.createdUsers.map((user, index) => (
                        <tr key={index} className="border-t">
                          <td className="p-2 font-mono text-xs">{user.email}</td>
                          <td className="p-2">{user.firstName} {user.lastName}</td>
                          <td className="p-2 font-mono text-xs">{user.tempPassword}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {importResult.errors.length > 0 && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Import Errors</AlertTitle>
            <AlertDescription className="mt-2">
              <div className="max-h-32 overflow-y-auto space-y-1">
                {importResult.errors.map((error, index) => (
                  <div key={index} className="text-sm">{error}</div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'upload': return 'Upload CSV File';
      case 'preview': return 'Review Import Data';
      case 'importing': return 'Importing Users';
      case 'complete': return 'Import Complete';
      default: return 'CSV Import';
    }
  };

  const getStepDescription = () => {
    switch (currentStep) {
      case 'upload': return 'Select a CSV file containing user data to import';
      case 'preview': return 'Review the data before importing to ensure accuracy';
      case 'importing': return 'Processing your CSV file and creating user accounts';
      case 'complete': return 'Your users have been imported successfully';
      default: return '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="csv-import-dialog">
        <DialogHeader>
          <DialogTitle>{getStepTitle()}</DialogTitle>
          <DialogDescription>
            {getStepDescription()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress indicator */}
          <div className="flex items-center space-x-2">
            {['upload', 'preview', 'importing', 'complete'].map((step, index) => (
              <div key={step} className="flex items-center">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep === step 
                      ? 'bg-primary text-primary-foreground' 
                      : index < ['upload', 'preview', 'importing', 'complete'].indexOf(currentStep)
                        ? 'bg-green-100 text-green-800'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {index < ['upload', 'preview', 'importing', 'complete'].indexOf(currentStep) ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < 3 && (
                  <div 
                    className={`w-16 h-0.5 ${
                      index < ['upload', 'preview', 'importing', 'complete'].indexOf(currentStep)
                        ? 'bg-green-200'
                        : 'bg-muted'
                    }`} 
                  />
                )}
              </div>
            ))}
          </div>

          <Separator />

          {/* Step content */}
          {currentStep === 'upload' && renderUploadStep()}
          {currentStep === 'preview' && renderPreviewStep()}
          {currentStep === 'importing' && renderImportingStep()}
          {currentStep === 'complete' && renderCompleteStep()}
        </div>

        <DialogFooter>
          {currentStep === 'preview' && previewData && (
            <>
              <Button 
                variant="outline" 
                onClick={() => setCurrentStep('upload')}
                data-testid="button-back-to-upload"
              >
                Back to Upload
              </Button>
              <Button 
                onClick={handleImportConfirm}
                disabled={previewData.validRows === 0 || importMutation.isPending}
                data-testid="button-confirm-import"
              >
                {importMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import {previewData.validRows} Users
              </Button>
            </>
          )}
          
          {(currentStep === 'upload' || currentStep === 'complete') && (
            <Button 
              variant="outline" 
              onClick={handleClose}
              data-testid="button-close"
            >
              {currentStep === 'complete' ? 'Close' : 'Cancel'}
            </Button>
          )}
          
          {currentStep === 'complete' && (
            <Button 
              onClick={handleReset}
              data-testid="button-import-another"
            >
              Import Another File
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}