import { useLayoutEffect, useRef, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
export function MathFormula({ latex, block = true }: { latex: string; block?: boolean }) {
  const host = useRef<HTMLSpanElement>(null),
    content = useRef<HTMLSpanElement>(null),
    [scale, setScale] = useState(1);
  const html = katex.renderToString(latex, {
    displayMode: block,
    throwOnError: false,
    strict: 'ignore',
    trust: false,
    output: 'htmlAndMathml',
  });
  useLayoutEffect(() => {
    const fit = () => {
      if (!host.current || !content.current || host.current.clientWidth === 0) return;
      const current = Number(content.current.dataset.scale) || 1,
        natural = content.current.getBoundingClientRect().width / current;
      if (natural > 0) {
        const next = Math.min(1, Math.max(0, host.current.clientWidth - 2) / natural);
        setScale((old) => (Math.abs(old - next) > 0.005 ? next : old));
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    if (host.current) observer.observe(host.current);
    if (content.current) observer.observe(content.current);
    return () => observer.disconnect();
  }, [latex]);
  return (
    <span ref={host} className={`math-formula ${block ? 'math-block' : ''}`}>
      <span
        ref={content}
        className="math-typeset"
        data-scale={scale}
        style={{ fontSize: `${scale}em` }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </span>
  );
}
