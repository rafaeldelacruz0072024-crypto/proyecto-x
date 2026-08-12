import { useEffect, useRef, useState } from 'react';

const AGENT_ID = 'agent_3901knyx13x2ezztqknkdy4v1qry';

const ElevenLabsWidget = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Inject script
    if (!document.querySelector('script[src*="elevenlabs.io/convai-widget"]')) {
      const script = document.createElement('script');
      script.src = 'https://elevenlabs.io/convai-widget/index.js';
      script.async = true;
      script.onerror = () => setHasError(true);
      document.body.appendChild(script);
    }

    // Listen for authorization errors from the widget
    const handleMessage = (e: MessageEvent) => {
      if (e.data && typeof e.data === 'string' && e.data.includes('not authorized')) {
        setHasError(true);
      }
    };
    window.addEventListener('message', handleMessage);

    // Inject custom element into container
    if (containerRef.current && !containerRef.current.querySelector('elevenlabs-convai')) {
      const widget = document.createElement('elevenlabs-convai');
      widget.setAttribute('agent-id', AGENT_ID);
      containerRef.current.appendChild(widget);
    }

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Hide widget silently if domain not authorized
  if (hasError) return null;

  return <div ref={containerRef} style={{ position: 'fixed', bottom: 0, right: 0, zIndex: 9999 }} />;
};

export default ElevenLabsWidget;
