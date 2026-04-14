import { LegalPageLayout } from "./LegalPageLayout";

export function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service">
      <section>
        <h2 className="text-white font-medium text-base mb-2">Non-Custodial Nature</h2>
        <p>
          Opaque is a set of smart contracts and a frontend interface. The developers
          and operators of this application never have access to your funds. You retain
          full control of your private keys and assets at all times. No one can freeze,
          seize, or move your funds without access to your keys.
        </p>
      </section>

      <section>
        <h2 className="text-white font-medium text-base mb-2">User Responsibility</h2>
        <p>
          You are solely responsible for the safety of your private keys and any local
          vault backups. Loss of keys or backup data may result in permanent loss of
          access to your funds. We recommend secure backup practices and do not store
          or recover keys on your behalf.
        </p>
      </section>

      <section>
        <h2 className="text-white font-medium text-base mb-2">Eligibility</h2>
        <p>
          You must be of legal age in your jurisdiction to use this service. Use is
          prohibited in jurisdictions where the use of non-custodial privacy tools or
          cryptocurrency is illegal. By using Opaque, you represent that you comply
          with all applicable laws in your location.
        </p>
      </section>
    </LegalPageLayout>
  );
}
