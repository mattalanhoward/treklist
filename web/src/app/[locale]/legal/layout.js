import PublicHeader from '@/components/PublicHeader';
import FooterLegal from '@/components/FooterLegal';

export default function LegalLayout({ children }) {
  return (
    <div className="flex flex-col min-h-screen bg-white text-gray-800">
      <PublicHeader variant="solid" showSections={false} />
      <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-10">
        {children}
      </main>
      <FooterLegal variant="dark" containerWidth="max-w-3xl" />
    </div>
  );
}
