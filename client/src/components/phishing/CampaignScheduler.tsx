import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar as CalendarIcon,
  Clock,
  Send,
  Timer,
  Repeat,
  AlertCircle,
  Check,
  X
} from 'lucide-react';
import { format, addDays, addHours, startOfDay, isBefore, isAfter } from 'date-fns';
import { cn } from '@/lib/utils';

interface ScheduleConfig {
  type: 'immediate' | 'scheduled' | 'recurring';
  scheduledDate?: Date;
  scheduledTime?: string;
  recurringPattern?: 'daily' | 'weekly' | 'monthly';
  recurringDays?: number[];
  recurringEndDate?: Date;
  batchSize?: number;
  batchDelay?: number;
  timezone?: string;
}

interface CampaignSchedulerProps {
  onSchedule: (config: ScheduleConfig) => void;
  isScheduling?: boolean;
  defaultConfig?: Partial<ScheduleConfig>;
}

export function CampaignScheduler({ onSchedule, isScheduling = false, defaultConfig }: CampaignSchedulerProps) {
  const [scheduleType, setScheduleType] = useState<ScheduleConfig['type']>(defaultConfig?.type || 'immediate');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(defaultConfig?.scheduledDate || undefined);
  const [selectedTime, setSelectedTime] = useState(defaultConfig?.scheduledTime || '09:00');
  const [recurringPattern, setRecurringPattern] = useState<ScheduleConfig['recurringPattern']>(defaultConfig?.recurringPattern || 'weekly');
  const [recurringDays, setRecurringDays] = useState<number[]>(defaultConfig?.recurringDays || [1]); // Monday by default
  const [recurringEndDate, setRecurringEndDate] = useState<Date | undefined>(defaultConfig?.recurringEndDate || addDays(new Date(), 30));
  const [enableBatching, setEnableBatching] = useState(false);
  const [batchSize, setBatchSize] = useState(defaultConfig?.batchSize || 50);
  const [batchDelay, setBatchDelay] = useState(defaultConfig?.batchDelay || 60);
  const [timezone, setTimezone] = useState(defaultConfig?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);

  const weekDays = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' }
  ];

  const handleSchedule = () => {
    const config: ScheduleConfig = {
      type: scheduleType,
      timezone
    };

    if (scheduleType === 'scheduled') {
      if (!selectedDate) return;
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const scheduledDateTime = new Date(selectedDate);
      scheduledDateTime.setHours(hours, minutes, 0, 0);
      config.scheduledDate = scheduledDateTime;
      config.scheduledTime = selectedTime;
    }

    if (scheduleType === 'recurring') {
      config.recurringPattern = recurringPattern;
      config.recurringDays = recurringDays;
      config.recurringEndDate = recurringEndDate;
    }

    if (enableBatching) {
      config.batchSize = batchSize;
      config.batchDelay = batchDelay;
    }

    onSchedule(config);
  };

  const toggleWeekDay = (day: number) => {
    setRecurringDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    );
  };

  const getScheduleSummary = () => {
    if (scheduleType === 'immediate') {
      return 'Campaign will be sent immediately upon creation';
    }
    
    if (scheduleType === 'scheduled' && selectedDate) {
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const scheduledDateTime = new Date(selectedDate);
      scheduledDateTime.setHours(hours, minutes, 0, 0);
      return `Scheduled for ${format(scheduledDateTime, 'MMM d, yyyy')} at ${selectedTime}`;
    }
    
    if (scheduleType === 'recurring') {
      const daysText = recurringDays.map(d => weekDays.find(wd => wd.value === d)?.label).join(', ');
      return `${recurringPattern} on ${daysText} until ${recurringEndDate ? format(recurringEndDate, 'MMM d, yyyy') : 'cancelled'}`;
    }
    
    return '';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timer className="w-5 h-5" />
          Campaign Scheduling
        </CardTitle>
        <CardDescription>
          Configure when and how your phishing campaign will be sent
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Schedule Type Selection */}
        <div className="space-y-4">
          <Label>Delivery Schedule</Label>
          <RadioGroup value={scheduleType} onValueChange={(v) => setScheduleType(v as ScheduleConfig['type'])}>
            <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
              <RadioGroupItem value="immediate" id="immediate" />
              <Label htmlFor="immediate" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  <span className="font-medium">Send Immediately</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Campaign starts as soon as it's created
                </p>
              </Label>
            </div>
            
            <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
              <RadioGroupItem value="scheduled" id="scheduled" />
              <Label htmlFor="scheduled" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  <span className="font-medium">Schedule for Later</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose a specific date and time to send
                </p>
              </Label>
            </div>
            
            <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
              <RadioGroupItem value="recurring" id="recurring" />
              <Label htmlFor="recurring" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Repeat className="w-4 h-4" />
                  <span className="font-medium">Recurring Campaign</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Automatically repeat on a schedule
                </p>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Scheduled Date/Time Picker */}
        {scheduleType === 'scheduled' && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="schedule-date">Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground"
                      )}
                      data-testid="schedule-date-picker"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={(date) => isBefore(date, startOfDay(new Date()))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="schedule-time">Time</Label>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <Input
                    id="schedule-time"
                    type="time"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    data-testid="schedule-time-picker"
                  />
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger data-testid="timezone-selector">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                  <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                  <SelectItem value="Europe/London">London (GMT)</SelectItem>
                  <SelectItem value="Europe/Paris">Paris (CET)</SelectItem>
                  <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                  <SelectItem value="Australia/Sydney">Sydney (AEDT)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Recurring Options */}
        {scheduleType === 'recurring' && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <div className="space-y-2">
              <Label>Recurrence Pattern</Label>
              <Select value={recurringPattern} onValueChange={(v) => setRecurringPattern(v as ScheduleConfig['recurringPattern'])}>
                <SelectTrigger data-testid="recurrence-pattern">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {recurringPattern === 'weekly' && (
              <div className="space-y-2">
                <Label>Days of Week</Label>
                <div className="flex gap-2">
                  {weekDays.map(day => (
                    <Button
                      key={day.value}
                      variant={recurringDays.includes(day.value) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleWeekDay(day.value)}
                      data-testid={`weekday-${day.label.toLowerCase()}`}
                    >
                      {day.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !recurringEndDate && "text-muted-foreground"
                    )}
                    data-testid="recurring-end-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {recurringEndDate ? format(recurringEndDate, "PPP") : "No end date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={recurringEndDate}
                    onSelect={setRecurringEndDate}
                    disabled={(date) => isBefore(date, addDays(new Date(), 1))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}

        {/* Batch Sending Options */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enable-batching">Batch Sending</Label>
              <p className="text-sm text-muted-foreground">
                Send emails in smaller groups to avoid detection
              </p>
            </div>
            <Switch
              id="enable-batching"
              checked={enableBatching}
              onCheckedChange={setEnableBatching}
              data-testid="enable-batching"
            />
          </div>

          {enableBatching && (
            <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">
              <div className="space-y-2">
                <Label htmlFor="batch-size">Batch Size</Label>
                <Input
                  id="batch-size"
                  type="number"
                  min={1}
                  max={1000}
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  data-testid="batch-size"
                />
                <p className="text-xs text-muted-foreground">Emails per batch</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="batch-delay">Delay Between Batches</Label>
                <Input
                  id="batch-delay"
                  type="number"
                  min={1}
                  max={3600}
                  value={batchDelay}
                  onChange={(e) => setBatchDelay(Number(e.target.value))}
                  data-testid="batch-delay"
                />
                <p className="text-xs text-muted-foreground">Seconds</p>
              </div>
            </div>
          )}
        </div>

        {/* Schedule Summary */}
        <div className="p-4 border rounded-lg bg-primary/5">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-primary mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">Schedule Summary</p>
              <p className="text-sm text-muted-foreground mt-1">
                {getScheduleSummary()}
              </p>
              {enableBatching && (
                <p className="text-sm text-muted-foreground mt-1">
                  Emails will be sent in batches of {batchSize} with {batchDelay} second delays
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button 
            onClick={handleSchedule} 
            disabled={isScheduling || (scheduleType === 'scheduled' && !selectedDate)}
            className="flex-1"
            data-testid="confirm-schedule"
          >
            {isScheduling ? (
              <>
                <div className="loading-spinner w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full mr-2"></div>
                Scheduling...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Confirm Schedule
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}