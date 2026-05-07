import { BrowserRouter } from 'react-router-dom';
import type { AppProps } from 'next/app';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <BrowserRouter>
      <Component {...pageProps} />
    </BrowserRouter>
  );
}
