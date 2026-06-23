# Authentication Setup Guide

## Overview
Your Clutch QR dashboard now has a modern, visually appealing login system with:
- ✅ Beautiful redesigned login page with 2-column layout
- ✅ Password-based authentication (no more magic links only)
- ✅ Forgot password / password reset flow
- ✅ Full Clutch branding throughout auth pages
- ⏳ Custom branded email templates (instructions below)

## What's New

### Login Page (`/login`)
- Modern 2-column design with branding on left, form on right
- Password sign-in (email + password)
- "Forgot password?" link
- Smooth animations and gradient backgrounds
- Mobile responsive

### Forgot Password Page (`/forgot-password`)
- Enter email to request password reset link
- Success confirmation message
- Email validation
- Consistent branding

### Reset Password Page (`/auth/reset-password`)
- User lands here after clicking reset link in email
- Set new password inline (no need to go to another app)
- Password confirmation validation
- Success confirmation with redirect to dashboard
- Minimum 8 characters required

## Setting Up Branded Email Templates

### The Issue
Supabase sends default emails that don't include Clutch branding. To fix this and customize the look:

### Solution: Add Custom Email Template in Supabase

#### Step 1: Go to Supabase Dashboard
1. Open [Supabase Dashboard](https://app.supabase.com)
2. Select your project (clutch-qr-system)
3. Go to **Authentication** → **Email Templates**

#### Step 2: Customize "Reset Password" Template
1. Click on **"Reset Password"** tab
2. Toggle **"Use custom template"** ON
3. Copy this HTML template below and paste into the editor:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f6f8fb;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(56, 72, 98, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #384862 0%, #2f3d55 100%);;
      color: white;
      padding: 40px 32px;
      text-align: center;
    }
    .logo {
      max-width: 200px;
      height: auto;
      margin-bottom: 20px;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    .content {
      padding: 40px 32px;
    }
    .content p {
      margin: 0 0 20px 0;
      line-height: 1.6;
      color: #172033;
      font-size: 15px;
    }
    .content p:last-of-type {
      margin-bottom: 30px;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #ffa665 0%, #ff8c47 100%);
      color: white;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .cta-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(255, 166, 101, 0.3);
    }
    .code {
      background: #fafbfc;
      border: 1px solid #e8edf4;
      border-radius: 4px;
      padding: 12px 16px;
      font-family: monospace;
      font-size: 13px;
      color: #384862;
      margin: 20px 0;
      word-break: break-all;
    }
    .footer {
      background: #f6f8fb;
      border-top: 1px solid #e8edf4;
      padding: 24px 32px;
      text-align: center;
      font-size: 12px;
      color: #687386;
    }
    .divider {
      height: 1px;
      background: #e8edf4;
      margin: 30px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Reset Your Password</h1>
    </div>
    
    <div class="content">
      <p>Hi there,</p>
      
      <p>We received a request to reset your password for your Clutch QR Dashboard account. Click the button below to create a new password.</p>
      
      <div style="text-align: center;">
        <a href="{{ .ConfirmationURL }}" class="cta-button">Reset Password</a>
      </div>
      
      <p><strong>Or copy this link:</strong></p>
      <div class="code">{{ .ConfirmationURL }}</div>
      
      <p style="font-size: 13px; color: #687386; margin-top: 30px;">
        This link expires in 24 hours. If you didn't request a password reset, please ignore this email.
      </p>
    </div>
    
    <div class="footer">
      <p>Questions? Contact us at <a href="mailto:support@clutchprintshop.com" style="color: #ffa665; text-decoration: none;">support@clutchprintshop.com</a></p>
      <p>&copy; 2026 Clutch Print Shop. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

4. Click **Save**

#### Step 3: Customize "Confirm Email" Template (Optional)
1. Click on **"Confirm email"** tab
2. Toggle **"Use custom template"** ON
3. Replace `{{ .ConfirmationURL }}` variable - same as above
4. Click **Save**

#### Step 4: Test the Flow
1. Go to `http://localhost:3000/forgot-password` (or your production URL)
2. Enter your email
3. Check your email inbox - should see branded reset link
4. Click link and test password reset

## FAQ

### Why can't users sign up through the dashboard?
Sign-ups go through Shopify/your website first. Dashboard is for existing customers only. Users get a welcome email with login instructions.

### How do I create initial user accounts?
Use Supabase Admin UI:
1. Go to **Authentication** → **Users**
2. Click **Add user**
3. Set email and password
4. User can then log in with password

### Can I send custom signup/welcome emails?
Yes, but it requires additional setup:
1. Create a "welcome" email template in Supabase
2. Trigger it from your signup flow via API
3. Use the same HTML template structure above

### What if users forget their email?
They can't reset without their email. This is a security best practice. Advise customers to:
- Check spam/promotions folders
- Use the email they registered with
- Contact support for account verification

## Current Status
- ✅ Login page redesigned and live
- ✅ Password reset flow complete
- ✅ All pages build successfully
- ⏳ Custom email templates need manual setup in Supabase (follow Step 2 above)
- ⏳ Test password reset in your environment

## Next Steps
1. **Add custom email template** (Step 2 above in Supabase Dashboard)
2. **Test password reset flow** in your environment
3. **Update your signup flow** to direct users to `/login` instead of magic links
4. **Send password setup emails** to existing customers with login instructions

## File Changes
- `app/login/page.tsx` - Redesigned login page
- `app/login/login.module.css` - Modern styling with animations
- `app/forgot-password/page.tsx` - Password reset request page
- `app/auth/reset-password/page.tsx` - Password reset confirmation page
- `lib/supabase-client.ts` - Browser client for auth operations

## Commit Reference
- `50ea9d3` - Create modern login UI with password-based authentication

---

**Need help?** Check Supabase docs: https://supabase.com/docs/guides/auth/auth-email
