import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function FooterLegal({
  variant = 'dark',
  containerWidth = 'max-w-4xl',
  className = '',
}) {
  const t = await getTranslations('footerLegal');
  const year = new Date().getFullYear();
  const dark = variant === 'dark';

  const wrap = dark ? 'bg-gray-900 text-gray-300' : 'bg-transparent text-gray-600';
  const link =
    (dark ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900') +
    ' underline underline-offset-2';
  const divider = dark ? 'border-gray-800' : 'border-gray-200';

  return (
    <footer className={`mt-auto ${wrap} ${className}`}>
      <div className={`border-t ${divider}`} />
      <div
        className={`${containerWidth} mx-auto px-4 md:px-6 py-8 md:py-10 grid gap-6 md:grid-cols-2 items-center`}
      >
        <div className="space-y-1 text-sm leading-6 text-center md:text-left">
          <p className="font-medium">{t('brandLine', { year })}</p>
          <p>{t('companyLine')}</p>
          <p>
            <a className={link} href="mailto:support@treklist.co">
              support@treklist.co
            </a>
          </p>
        </div>

        <nav className="justify-self-center md:justify-self-end">
          <ul className="flex flex-wrap justify-center md:justify-end gap-x-5 gap-y-2 text-sm">
            <li><Link className={link} href="/legal/privacy">{t('links.privacy')}</Link></li>
            <li><Link className={link} href="/legal/cookies">{t('links.cookies')}</Link></li>
            <li><Link className={link} href="/legal/cookie-settings">{t('links.cookieSettings')}</Link></li>
            <li><Link className={link} href="/legal/terms">{t('links.terms')}</Link></li>
            <li><Link className={link} href="/legal/affiliate-disclosure">{t('links.affiliateDisclosure')}</Link></li>
            <li><Link className={link} href="/legal/imprint">{t('links.imprint')}</Link></li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
