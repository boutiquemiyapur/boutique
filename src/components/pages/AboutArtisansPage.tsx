import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

const sections = [
  ['Brand story', 'AB Collection’s brand story is being prepared with the client. This space is intentionally reserved for approved copy.'],
  ['Philosophy', 'A concise statement of the values behind the collection can be added here once confirmed.'],
  ['Collection', 'Current collection descriptions, categories, and product details are managed as catalog data and should be reviewed before publication.'],
  ['Quality & customer experience', 'Care, shipping, returns, and service information will be published only after AB Collection approves the final policies.']
];

export const AboutArtisansPage: React.FC = () => {
  const { navigate } = useStore();
  return <main className="min-h-screen bg-[#fffdf9] px-4 py-12 sm:px-7 sm:py-16"><div className="mx-auto max-w-5xl"><header className="max-w-3xl"><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-stone-500">About AB Collection</p><h1 className="mt-3 font-serif text-4xl sm:text-6xl">A story ready to be told.</h1><p className="mt-5 text-sm leading-7 text-stone-600">AB Collection’s final brand history has not yet been supplied. Rather than inventing it, this page is structured for the client’s approved narrative.</p></header><div className="mt-12 grid gap-px border border-[#ddd7cf] bg-[#ddd7cf] md:grid-cols-2">{sections.map(([title, body]) => <section key={title} className="bg-white p-7 sm:p-9"><h2 className="font-serif text-2xl">{title}</h2><p className="mt-3 text-sm leading-6 text-stone-600">{body}</p></section>)}</div><button onClick={() => navigate('shop')} className="mt-10 inline-flex items-center gap-2 bg-[#2c2926] px-6 py-3 text-[11px] font-semibold uppercase tracking-[.12em] text-white">Explore the collection <ArrowRight className="h-4 w-4" /></button></div></main>;
};
