import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export const AboutArtisansPage: React.FC = () => {
  const { navigate, cms } = useStore();
  const about = cms.about;
  const sections = [['Brand story', about.brandStory], ['Philosophy', about.philosophy], ['More about us', about.additionalInformation]];
  return <main className="min-h-screen bg-[#fffdf9] px-4 py-12 sm:px-7 sm:py-16"><div className="mx-auto max-w-5xl"><header className="max-w-3xl">{about.image && <img src={about.image} alt="" className="mb-8 aspect-[16/7] w-full object-cover" />}<p className="text-[10px] font-semibold uppercase tracking-[.2em] text-stone-500">About {about.businessName}</p><h1 className="mt-3 font-serif text-4xl sm:text-6xl">{about.heading}</h1><p className="mt-5 text-sm leading-7 text-stone-600">{about.introduction}</p></header><div className="mt-12 grid gap-px border border-[#ddd7cf] bg-[#ddd7cf] md:grid-cols-3">{sections.map(([title, body]) => <section key={title} className="bg-white p-7 sm:p-9"><h2 className="font-serif text-2xl">{title}</h2><p className="mt-3 text-sm leading-6 text-stone-600">{body}</p></section>)}</div><button onClick={() => navigate('shop')} className="mt-10 inline-flex items-center gap-2 bg-[#2c2926] px-6 py-3 text-[11px] font-semibold uppercase tracking-[.12em] text-white">Explore the collection <ArrowRight className="h-4 w-4" /></button></div></main>;
};
