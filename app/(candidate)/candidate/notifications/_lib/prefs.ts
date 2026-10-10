export interface NotificationPrefs {
  in_app: boolean;
  email: boolean;
  sms: boolean;
  application_updates: boolean;
  interview_reminders: boolean;
  job_alert_digests: boolean;
}

export const DEFAULT_PREFS: NotificationPrefs = {
  in_app: true,
  email: true,
  sms: false,
  application_updates: true,
  interview_reminders: true,
  job_alert_digests: true,
};
