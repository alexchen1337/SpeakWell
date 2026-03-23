import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="terms-page">
      <div className="terms-page__container">
        <div className="terms-page__top">
          <h1>Terms of Service</h1>
          <p>Last updated: March 12, 2026</p>
        </div>

        <section>
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using SpeakWell, you agree to be bound by these Terms of Service.
            If you do not agree, do not use the service.
          </p>
        </section>

        <section>
          <h2>2. Use of the Service</h2>
          <p>
            SpeakWell provides AI-assisted analysis of uploaded presentation recordings and related
            content. You are responsible for ensuring you have the rights and permissions to upload
            any audio, video, transcripts, or rubric materials.
          </p>
        </section>

        <section>
          <h2>3. Accounts</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials and
            for all activity under your account.
          </p>
        </section>

        <section>
          <h2>4. Content and Privacy</h2>
          <p>
            You retain ownership of content you submit. By using the service, you grant SpeakWell
            permission to process that content to provide grading, analytics, and product
            improvements.
          </p>
        </section>

        <section>
          <h2>5. Prohibited Conduct</h2>
          <p>
            You may not use SpeakWell to upload unlawful, abusive, or infringing content, attempt
            unauthorized access, or interfere with the platform&apos;s operation.
          </p>
        </section>

        <section>
          <h2>6. Availability and Changes</h2>
          <p>
            We may modify, suspend, or discontinue parts of the service at any time. We may also
            update these Terms from time to time by posting a revised version on this page.
          </p>
        </section>

        <section>
          <h2>7. Disclaimer</h2>
          <p>
            The service is provided &quot;as is&quot; without warranties of any kind. AI-generated
            feedback is informational and should be reviewed by instructors or users as appropriate.
          </p>
        </section>

        <section>
          <h2>8. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, SpeakWell and its operators are not liable for
            indirect, incidental, or consequential damages arising from use of the service.
          </p>
        </section>

        <section>
          <h2>9. Contact</h2>
          <p>
            Questions about these terms can be directed to your SpeakWell administrator or support
            contact.
          </p>
        </section>

        <div className="terms-page__actions">
          <Link href="/">Back to home</Link>
          <Link href="/login">Go to login</Link>
        </div>
      </div>
    </main>
  );
}
