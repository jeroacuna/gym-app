import '../styles/globals.css'
import { Toaster } from 'react-hot-toast'

export default function App({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 10000,
          style: {
            background: '#fff',
            color: '#0a0a0a',
            border: '1px solid #e5e7eb',
            borderRadius: '0.75rem',
            padding: '0.75rem 1rem',
            maxWidth: '360px',
          },
        }}
      />
    </>
  )
}