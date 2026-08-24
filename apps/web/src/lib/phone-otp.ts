/** Phone SMS OTP is optional and off by default (provider subscription cost). */
export function isPhoneOtpEnabled(): boolean {
  return process.env.PHONE_OTP_ENABLED?.trim().toLowerCase() === "true";
}
