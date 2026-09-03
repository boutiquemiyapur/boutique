import React, { useRef, useState } from 'react';
import { ImagePlus, LoaderCircle, RotateCcw, Trash2 } from 'lucide-react';
import { cmsRepository } from '../../services/cmsRepository';

type MediaFolder = 'products' | 'banners' | 'about';

interface MediaUploaderProps {
  folder: MediaFolder;
  recordId: string;
  value?: string;
  onUploaded: (url: string) => void;
  onRemove?: () => void;
  label?: string;
  previewClassName?: string;
}

/** Shared Admin control: file picker → signed Cloudinary upload → form URL. */
export const MediaUploader: React.FC<MediaUploaderProps> = ({ folder, recordId, value, onUploaded, onRemove, label = 'Upload image', previewClassName = 'aspect-[4/3] w-full object-cover' }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const uploading = progress !== null && progress < 100;
  const choose = () => inputRef.current?.click();
  const selectFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null); setUploaded(false); setPreviewError(false); setProgress(0);
    try {
      const url = await cmsRepository.uploadImage(file, folder, recordId, setProgress);
      onUploaded(url); setUploaded(true); setProgress(100);
    } catch (uploadError) {
      setProgress(null);
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed. Please try again.');
    }
  };
  const remove = () => { onRemove?.(); setUploaded(false); setError(null); setPreviewError(false); setProgress(null); };
  return <div className="mt-2 border border-dashed border-stone-300 bg-stone-50 p-3 text-xs">
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={selectFile} />
    <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={choose} disabled={uploading} className="inline-flex min-h-9 items-center gap-2 border border-stone-400 bg-white px-3 font-semibold disabled:opacity-60">{uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}{uploading ? 'Uploading image…' : value ? 'Replace image' : label}</button>{value && onRemove && <button type="button" onClick={remove} disabled={uploading} className="inline-flex min-h-9 items-center gap-1 text-rose-700 disabled:opacity-60"><Trash2 className="h-4 w-4" />Remove</button>}</div>
    {progress !== null && <div className="mt-3"><div className="h-1.5 overflow-hidden bg-stone-200"><div className="h-full bg-[#625e59] transition-all" style={{ width: `${progress}%` }} /></div><p className="mt-1 text-stone-600">{progress < 100 ? `Uploading image… ${progress}%` : '✓ Image uploaded. This Cloudinary image will be saved with the form.'}</p></div>}
    {error && <div role="alert" className="mt-3 flex items-center justify-between gap-3 text-rose-700"><span>{error}</span><button type="button" onClick={choose} className="inline-flex shrink-0 items-center gap-1 underline"><RotateCcw className="h-3.5 w-3.5" />Try again</button></div>}
    {value && !previewError && <img src={value} alt="Selected media preview" onError={() => setPreviewError(true)} className={`mt-3 ${previewClassName}`} />}
    {value && previewError && <p role="alert" className="mt-3 text-rose-700">This image URL could not be previewed. Check the URL or replace the image.</p>}
  </div>;
};
