import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Sparkles } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-accent/20 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold gradient-text">ORBIT</h1>
              <p className="text-xs text-muted-foreground">A Desmond Labs Product</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => window.close()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Close
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="px-6 py-8">
        <div className="max-w-4xl mx-auto prose prose-slate dark:prose-invert max-w-none">
          <h1 className="text-3xl font-bold mb-8 gradient-text">Privacy Policy for ORBIT by Desmond Labs</h1>
          
          <div className="space-y-6 text-sm leading-relaxed">
            <div className="bg-card/50 border border-accent/20 rounded-lg p-4">
              <p><strong>Effective Date:</strong> 2025-07-01</p>
              <p><strong>Last Updated:</strong> 2025-07-01</p>
            </div>

            <section>
              <h2 className="text-xl font-semibold mb-4">1. Introduction: Our Commitment to Your Privacy</h2>
              <p className="mb-4">
                This Privacy Policy outlines the data practices of Desmond Labs ("we," "us," or "our") concerning the ORBIT (Optical Recognition for Brand Image Taxonomy) service ("Service"). The ORBIT Service is designed to be an intuitive visual intelligence partner for Small to Medium Businesses (SMBs), transforming how you manage, understand, and leverage your valuable visual assets.
              </p>
              <p className="mb-4">
                We understand that your brand and product imagery are critical business assets. Entrusting them to a service requires a high degree of confidence and transparency. This policy is designed to provide you with a clear and comprehensive understanding of what information we collect, why we collect it, and how we use and protect it. Our approach is rooted in the ORBIT brand voice: Clear, Precise, Confident, and Technical but Accessible.
              </p>
              <p className="mb-4">
                The business model for ORBIT is built on delivering a premium, high-value service that provides a "Permanent Intelligence Investment" for each image processed. This value proposition can only be realized if it is built on a foundation of trust. Therefore, this Privacy Policy is not merely a legal document but a core component of our commitment to you. It is a detailed account of how we handle your data in a way that is secure, respectful of your ownership, and aligned with your interests.
              </p>
              <p>
                By registering for, accessing, or using the ORBIT Service, you acknowledge that you have read, understood, and agree to the collection, storage, use, and disclosure of your information as described in this Privacy Policy.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-3">Key Definitions</h3>
              <p className="mb-2">To ensure clarity, the following terms are used throughout this policy:</p>
              <ul className="space-y-2 ml-4">
                <li><strong>Service:</strong> Refers to the ORBIT platform, including the web application hosted at our designated domain, all associated AI processing features, application programming interfaces (APIs), and related technologies provided by Desmond Labs.</li>
                <li><strong>User, You, Your:</strong> Refers to the individual, business entity, or organization that registers for and uses the Service.</li>
                <li><strong>Personal Data:</strong> Refers to any information that relates to an identified or identifiable individual. This includes information you provide during registration, such as your name and email address, as well as certain information collected automatically, like your IP address. This definition is aligned with global privacy regulations such as the General Data Protection Regulation (GDPR) and the California Consumer Privacy Act (CCPA).</li>
                <li><strong>Your Content:</strong> Refers specifically to the digital image files and any associated user-provided context that you voluntarily upload to the Service for processing and analysis. We consider you the owner and controller of Your Content.</li>
                <li><strong>Image Intelligence Data:</strong> Refers to the structured metadata, tags, text extractions (OCR), color analyses, and other analytical information that our Service generates from Your Content during processing (e.g., dominant_colors_hex_array, primary_object_detected, ocr_text_snippet).</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">2. The Information We Collect and How We Collect It</h2>
              <p className="mb-4">
                To provide and improve the ORBIT Service, we collect information in several ways. We are committed to collecting only the data that is necessary for the specific, defined purposes outlined in this policy.
              </p>

              <h3 className="text-lg font-semibold mb-3">2.1. Information You Provide Directly to Us</h3>
              <p className="mb-4">
                <strong>Account Information:</strong> When you create an ORBIT account, we require you to provide an email address and a secure, hashed password. If you choose to register using a third-party service like Google Social Login, we will receive your name, email address, and profile picture from Google, but only after you have explicitly granted permission on the Google consent screen. We never receive or store your Google account password. This process is managed by our secure authentication provider, Firebase Authentication.
              </p>
              <p className="mb-4">
                <strong>Payment and Subscription Information:</strong> To purchase image processing credits or subscribe to a service plan, you will need to provide payment information, such as your credit or debit card number, card expiration date, CVC code, and billing address. This information is provided directly to our third-party payment processor, Stripe, through a secure portal. We do not collect, receive, or store your full payment card details on our servers. We only receive a secure token from Stripe that represents your payment method, along with confirmation of payment and subscription status, which allows us to manage your account and credits.
              </p>
              <p className="mb-4">
                <strong>Your Content (User-Uploaded Images):</strong> The core function of the Service involves you uploading your digital images for processing. When you upload images, we collect the files themselves along with associated file information such as the originalFileName, mimeType, and fileSize. This content is stored securely in our cloud infrastructure, provided by Firebase Storage.
              </p>
              <p className="mb-4">
                <strong>Communications:</strong> If you contact us for customer support, provide feedback, or make any other inquiry, we will collect your name, email address, and the content of your message. This allows us to respond to your requests and improve our Service.
              </p>

              <h3 className="text-lg font-semibold mb-3">2.2. Information We Generate and Process</h3>
              <p className="mb-4">
                <strong>Image Intelligence Data:</strong> This is the primary value created by the ORBIT Service. When we process Your Content, our integrated AI partners generate structured metadata. This data can include detected objects and concepts, dominant color palettes, and any text recognized within the image (OCR). This Image Intelligence Data is programmatically linked to your corresponding image within our database (Firebase Firestore) and is made available for you to view. Upon your request, this data can be embedded directly into your image file's metadata header (using the XMP standard) when you download it, creating the "Permanent Intelligence Investment".
              </p>
              <p className="mb-4">
                <strong>Service Usage and Transactional Data:</strong> As you use the Service, we generate data related to your activity. This includes creating unique identifiers for your image batches (batchID), logging timestamps of uploads and processing events (uploadTimestamp, processingStatus), and maintaining a log of your image credit purchases and usage (ImageCreditsLog). This data is essential for the operational functionality of the Service, billing, and providing you with an accurate history of your activities.
              </p>

              <h3 className="text-lg font-semibold mb-3">2.3. Information We Collect Automatically</h3>
              <p className="mb-4">
                <strong>Device and Connection Information (Log Data):</strong> When you access the ORBIT Service, our servers automatically record certain information. This log data includes your Internet Protocol (IP) address, the type and version of the browser you are using (user-agent string), your operating system, and the date and time of your requests. This information is collected for essential purposes such as ensuring the security of our platform, preventing fraudulent activity, diagnosing technical problems, and analyzing service performance. This is a standard and necessary practice employed by our infrastructure provider, Firebase.
              </p>
              <p className="mb-4">
                <strong>Cookies and Similar Technologies:</strong> We use cookies, which are small text files stored on your device, to operate and improve the Service. We use them for essential functions, such as keeping you logged in during a session (session cookies) and remembering your preferences. We may also use cookies for analytics purposes, with the help of services like Google Analytics, to understand how users interact with our platform. We will obtain your consent for any non-essential cookies through a clear consent mechanism. For more detailed information, please refer to our separate Cookie Policy, which will provide instructions on how to manage your cookie preferences.
              </p>
              <p>
                The technical architecture of ORBIT is designed to be a sophisticated and secure orchestration layer. It acts as a "data conduit," managing the flow of information between you and our specialized AI partners. When you upload an image, it is securely stored in Firebase Storage. A cloud function then sends that image, and only that image, to our AI partners (Google AI and Anthropic's Claude API) for analysis. The resulting Image Intelligence Data is then sent back to us and stored in our database, ready for you to access. This entire process is designed to be temporary and purpose-limited, ensuring your data is only handled when necessary to provide the Service you have requested.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">3. How and Why We Use Your Information (Legal Basis for Processing)</h2>
              <p className="mb-4">
                Our use of your information is purposeful and is grounded in established legal bases as required by regulations like the GDPR. We process your data to provide the powerful service you expect, to secure our platform, and to communicate with you effectively.
              </p>

              <h3 className="text-lg font-semibold mb-3">3.1. To Provide, Maintain, and Improve the ORBIT Service</h3>
              <p className="mb-2"><strong>Legal Basis:</strong> Performance of a Contract</p>
              <ul className="space-y-2 ml-4 mb-4">
                <li>We use your Account Information to create and manage your account, authenticate you, and grant you access to the Service.</li>
                <li>We use Your Content as the fundamental input for the Service. We send it to our AI Processing partners to generate the Image Intelligence Data that forms the core of our offering. This processing is what enables "AI-Powered Discovery" and creates the "Permanent Intelligence Investment" that enhances the value of your assets. Without this processing, we cannot fulfill our contractual obligation to you.</li>
                <li>We use your Service Usage Data to track your image processing jobs, manage your image credit balance, and provide you with an accurate history of your activities within the platform.</li>
              </ul>

              <h3 className="text-lg font-semibold mb-3">3.2. For Security, Legality, and Fraud Prevention</h3>
              <p className="mb-2"><strong>Legal Basis:</strong> Legitimate Interest and Legal Obligation</p>
              <ul className="space-y-2 ml-4 mb-4">
                <li>We process Device and Connection Information, such as IP addresses, to monitor for and prevent malicious or fraudulent activity, protect the integrity and security of the Service, and diagnose technical issues. This is a legitimate interest we share with you in maintaining a safe and reliable platform. This practice is also a standard security measure for our infrastructure provider, Firebase.</li>
                <li>We share necessary Account and Payment Information with Stripe to process your transactions securely. This is also necessary to comply with our legal obligations under financial regulations, including anti-money laundering (AML) and know-your-customer (KYC) laws.</li>
              </ul>

              <h3 className="text-lg font-semibold mb-3">3.3. To Communicate With You</h3>
              <p className="mb-2"><strong>Legal Basis:</strong> Performance of a Contract and Consent</p>
              <ul className="space-y-2 ml-4 mb-4">
                <li>We use your Account Information, specifically your email address, to send you essential, non-promotional (transactional) communications about your account and the Service. These include your welcome email, notifications about the status of your image processing batches (e.g., "batch complete"), important security alerts, and updates to our terms or this Privacy Policy. The voice of these communications will always align with the ORBIT brand: "Clear, Precise, Confident, Technical but Accessible".</li>
                <li>For promotional communications, such as newsletters about new features, user tips, or special offers, we will only contact you if you have provided your explicit consent. We will provide a clear and simple method to unsubscribe or opt-out from these marketing communications in every email we send.</li>
              </ul>

              <h3 className="text-lg font-semibold mb-3">3.4. For Analytics and Product Development</h3>
              <p className="mb-2"><strong>Legal Basis:</strong> Legitimate Interest</p>
              <p className="mb-4">
                We analyze aggregated and anonymized Service Usage Data and data collected from Analytics Cookies to understand user behavior and how our Service is being used. This analysis is crucial for our legitimate interest in improving the user experience, identifying and prioritizing the development of new features, and fulfilling our long-term business objective to "Cultivate Actionable Insights" for future versions of the platform.
              </p>
              <p>
                A critical point of clarification is how we handle Your Content in relation to AI model training. A primary concern for users of any AI service is whether their proprietary data will be used to train the underlying models. We have specifically chosen AI partners whose commercial terms align with our pro-privacy stance. Both Google Cloud and Anthropic have strong commitments regarding customer data. Google Cloud does not use customer data submitted to its AI Platform for advertising purposes or to train its models. Similarly, Anthropic does not use customer data submitted via its commercial API to train its models.
              </p>
              <p>
                Therefore, we can state unequivocally: We do not use Your Content (your images) to train our own or any third-party AI models. We do not permit our partners to use Your Content for any purpose other than to generate the Image Intelligence Data you have requested. This inherited commitment is a core feature of our Service, transforming this policy section from a standard disclosure into a key pillar of the trust we aim to build with you.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">4. Data Sharing and Disclosure: Our Third-Party Partners</h2>
              <p className="mb-4">
                We are committed to transparency about how your data is handled. We want to be clear that we do not sell your Personal Data or Your Content to any third parties. To provide the ORBIT Service, we partner with a select number of third-party service providers, also known as sub-processors. We share information with them only when it is necessary to deliver, secure, and improve our Service. We have vetted these partners and have data processing agreements in place to ensure they handle your data with a high standard of care.
              </p>
              
              <div className="bg-card/30 border border-accent/20 rounded-lg p-4 mb-4">
                <h4 className="font-semibold mb-2">Key Third-Party Partners:</h4>
                <ul className="space-y-2 text-sm">
                  <li><strong>Google Cloud (Firebase):</strong> Core infrastructure, hosting, database, authentication</li>
                  <li><strong>Google AI Platform:</strong> AI image analysis (temporary processing only)</li>
                  <li><strong>Anthropic (Claude API):</strong> AI orchestration and metadata generation (temporary processing only)</li>
                  <li><strong>Stripe:</strong> Payment processing and billing</li>
                  <li><strong>Lovable:</strong> Web application hosting</li>
                </ul>
              </div>
              
              <p>
                In addition to the above, we may disclose your information if we believe in good faith that it is required by law, such as in response to a subpoena, court order, or other legal process. We may also disclose information to protect our rights, property, or safety, or the rights, property, or safety of our users or others.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">5. Data Retention, Deletion, and Your Control</h2>
              <p className="mb-4">
                We believe in data minimization and providing you with full control over your information. Our data retention policies are designed to keep your data only for as long as necessary to provide the Service or to comply with legal obligations.
              </p>

              <h3 className="text-lg font-semibold mb-3">Retention Periods</h3>
              <ul className="space-y-2 ml-4 mb-4">
                <li><strong>Your Content and Image Intelligence Data:</strong> This data is retained in our active systems for as long as your account is active, enabling you to access, view, and download your processed images at any time. If you choose to delete a specific image or an entire batch from your dashboard, it will be removed from our active systems promptly.</li>
                <li><strong>Account Information:</strong> Your account information (e.g., email address, subscription status) is retained for the duration of your account's existence with us.</li>
              </ul>

              <h3 className="text-lg font-semibold mb-3">Your Control and Deletion Rights</h3>
              <p className="mb-4">You are in control of your data on the ORBIT platform.</p>
              <ul className="space-y-2 ml-4 mb-4">
                <li><strong>Data Management:</strong> From within the Service dashboard, you have the ability to view, manage, and delete individual images or entire processing batches.</li>
                <li><strong>Account Deletion:</strong> You can request the deletion of your entire ORBIT account at any time through your account settings or by contacting our support team. Initiating an account deletion will trigger a process to permanently remove your Account Information, Your Content, and associated Image Intelligence Data from our active systems and will also trigger deletion requests to our sub-processors, subject to their respective retention timelines and any overriding legal obligations.</li>
              </ul>
              
              <p>
                A key aspect of the ORBIT value proposition is the "Permanent Intelligence Investment," which refers to the XMP metadata we embed into your image files upon download. This creates an important point of data responsibility transfer. While we act as the data controller for the information stored on our platform, once you download an enhanced image file to your own local system or cloud storage, you become the controller of that file and the embedded Image Intelligence Data. This policy applies only to the data residing on the ORBIT Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">6. Your Data Protection Rights</h2>
              <p className="mb-4">
                We are committed to upholding your data protection rights as granted by applicable laws, including the GDPR for users in the European Economic Area and the CCPA for residents of California. We provide these rights to all our users, regardless of their location.
              </p>

              <ul className="space-y-2 ml-4 mb-4">
                <li><strong>The Right to Access:</strong> You have the right to request a copy of the Personal Data and Your Content that we hold about you.</li>
                <li><strong>The Right to Rectification:</strong> If you believe any Personal Data we hold about you is inaccurate or incomplete, you have the right to request that we correct or complete it.</li>
                <li><strong>The Right to Erasure (The "Right to be Forgotten"):</strong> You have the right to request the deletion of your Personal Data from our systems. We will comply with this request, subject to any legal or regulatory obligations that require us to retain certain information.</li>
                <li><strong>The Right to Restrict Processing:</strong> You have the right to request that we temporarily or permanently stop processing all or some of your Personal Data.</li>
                <li><strong>The right to Data Portability:</strong> You have the right to request a copy of your Personal Data in a structured, commonly used, and machine-readable format, and the right to transmit that data to another service.</li>
                <li><strong>The Right to Object:</strong> You have the right to object to us processing your Personal Data for certain purposes, such as direct marketing.</li>
              </ul>

              <h3 className="text-lg font-semibold mb-3">How to Exercise Your Rights</h3>
              <p>
                To exercise any of the rights described above, please submit a request to our dedicated privacy contact email: <a href="mailto:privacy@desmondlabs.com" className="text-accent hover:text-accent/80 underline">privacy@desmondlabs.com</a>. We will respond to your request in a timely manner and in accordance with applicable data protection laws. For your protection, we may need to verify your identity before fulfilling your request.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">7. Security of Your Information</h2>
              <p className="mb-4">
                We take the security of your information very seriously and have implemented a range of technical and organizational measures to protect your Personal Data and Your Content from unauthorized access, use, alteration, or destruction. Our security posture is designed to meet the "enterprise-grade security" standard expected by our users.
              </p>

              <ul className="space-y-2 ml-4 mb-4">
                <li><strong>Encryption:</strong> All data transferred between you and our Service is encrypted in transit using industry-standard Transport Layer Security (TLS). All of your Personal Data and Your Content are encrypted at rest using strong encryption standards like AES-256. This is a standard security feature provided by our core infrastructure partners, including Firebase and Stripe.</li>
                <li><strong>Access Controls:</strong> We enforce strict internal access controls. Access to your Personal Data and Your Content by Desmond Labs employees is limited to a need-to-know basis, and all such access is logged and audited. We use multi-factor authentication for all internal systems that contain sensitive data.</li>
                <li><strong>Secure Infrastructure:</strong> We build ORBIT on top of world-class, secure infrastructure provided by Google Cloud. This allows us to leverage their extensive security expertise and compliance with leading international security standards, including SOC 2 and ISO/IEC 27001. This practice of "borrowed trust" means your data is protected by the same robust security that underpins Google's own services.</li>
                <li><strong>Payment Security:</strong> We do not handle or store your raw payment card details. All payments are processed by Stripe, which is certified as a PCI DSS Level 1 Service Provider. This is the most stringent level of certification available in the payments industry, ensuring your financial information is handled with the highest level of security.</li>
                <li><strong>Incident Response:</strong> We have established procedures to detect and respond to any potential data security incidents. In the event of a data breach, we will take immediate steps to mitigate the impact and will notify affected users and relevant authorities in accordance with our legal obligations.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">8. International Data Transfers</h2>
              <p className="mb-4">
                ORBIT is a global service. To provide you with the Service, your information, including Personal Data and Your Content, may be transferred to, and processed in, countries other than your country of residence. Our primary infrastructure and sub-processors are located in the United States.
              </p>
              <p>
                We understand that when data is transferred across borders, it must remain protected. We ensure that all international data transfers are lawful and secure by relying on established legal mechanisms. Our key sub-processors, including Google and Stripe, are certified under the EU-U.S. Data Privacy Framework, which provides a recognized mechanism for lawful data transfers from the European Union, United Kingdom, and Switzerland to the United States. Where necessary, we also rely on Standard Contractual Clauses (SCCs) as approved by the European Commission to ensure that your data receives an adequate level of protection when processed outside of the EEA.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">9. Children's Privacy</h2>
              <p>
                The ORBIT Service is a business-to-business (B2B) platform designed for use by professionals and organizations. It is not directed to or intended for use by individuals under the age of 18 (or the age of legal majority in their jurisdiction). We do not knowingly collect Personal Data from children. If we become aware that we have inadvertently collected Personal Data from a child, we will take steps to delete that information as soon as possible.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">10. Changes to This Privacy Policy</h2>
              <p>
                As our Service evolves, we may need to update this Privacy Policy to reflect changes in our data practices, the law, or our Service features. We reserve the right to modify this policy at any time. When we make material changes, we will provide you with prominent notice, for example, by sending an email to the address associated with your account or by displaying a notification within the Service. We will also update the "Last Updated" date at the top of this policy. We encourage you to review this policy periodically to stay informed about our privacy practices.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">11. How to Contact Us</h2>
              <p className="mb-4">
                Your privacy and trust are important to us. If you have any questions, comments, or concerns about this Privacy Policy, our data practices, or if you wish to exercise your data protection rights, please do not hesitate to contact us.
              </p>
              <p>
                You can reach our dedicated privacy team at:
              </p>
              <p className="ml-4">
                <strong>Email:</strong> <a href="mailto:privacy@desmondlabs.com" className="text-accent hover:text-accent/80 underline">privacy@desmondlabs.com</a>
              </p>
              <p>
                We are committed to working with you to obtain a fair resolution of any complaint or concern about privacy.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}