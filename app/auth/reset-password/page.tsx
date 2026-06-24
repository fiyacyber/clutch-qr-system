'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase-client';
import { PASSWORD_POLICY_HELPER_TEXT, validatePasswordPolicy } from '@/lib/password-policy';
import Link from 'next/link';
import styles from '../../login/login.module.css';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const policyError = validatePasswordPolicy(password);
    if (policyError) {
      setError(policyError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      router.push('/portal');
    }, 2000);
  };

  return (
    <div className={styles.container}>
      <div className={styles.background} />
      
      <div className={styles.contentSingle}>

        <div className={styles.formSide}>
          <div className={styles.formCard}>
            <div className={styles.formHeader}>
              <h2>Create New Password</h2>
              <p>{PASSWORD_POLICY_HELPER_TEXT}</p>
            </div>

            {success ? (
              <div className={styles.successAlert}>
                <div className={styles.successIcon}>✓</div>
                <h3>Password updated!</h3>
                <p>Redirecting you to your dashboard...</p>
              </div>
            ) : (
              <>
                {error && (
                  <div className={styles.alert}>
                    {error}
                  </div>
                )}

                <form className={styles.form} onSubmit={handleResetPassword}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>New Password</label>
                    <input
                      className={styles.input}
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 12 characters"
                      required
                      autoComplete="new-password"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Confirm Password</label>
                    <input
                      className={styles.input}
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your password"
                      required
                      autoComplete="new-password"
                    />
                  </div>

                  <button
                    className={styles.submitButton}
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? 'Updating...' : 'Update Password'}
                    {!loading && <span className={styles.arrowIcon}>→</span>}
                  </button>
                </form>
              </>
            )}

            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <Link href="/login" className={styles.signupLink}>
                Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
