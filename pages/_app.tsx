import '../styles/globals.css';
import type { AppProps } from 'next/app';

// ← ADD THESE TWO LINES
import { Poppins } from 'next/font/google';

// Configure Poppins (weight 400,500,600,700 is most common)
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',   // this allows using font-poppins CSS variable
  display: 'swap',
});

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      {/* Apply the font globally */}
      <style jsx global>{`
        html {
          font-family: ${poppins.style.fontFamily};
        }
      `}</style>
      <main className={poppins.className}>   {/* Alternative way */}
        <Component {...pageProps} />
      </main>
    </>
  );
}

export default MyApp;