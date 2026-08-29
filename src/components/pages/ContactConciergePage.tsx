import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  Video,
  Send,
  Sparkles,
  Calendar,
  CheckCircle2
} from 'lucide-react';

export const ContactConciergePage: React.FC = () => {
  const { showToast } = useStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredDate, setPreferredDate] = useState('2026-09-01');
  const [preferredTime, setPreferredTime] = useState('11:30 AM IST');
  const [occasion, setOccasion] = useState('Bridal Muhurtham');
  const [notes, setNotes] = useState('');
  const [isBooked, setIsBooked] = useState(false);

  const handleSubmitAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    setIsBooked(true);
    showToast(
      'Virtual Appointment Requested',
      `Thank you ${name}! Our senior bridal stylist will WhatsApp you the HD video call link for ${preferredDate} at ${preferredTime}.`
    );
  };

  return (
    <div className="bg-[#FAF7F2] min-h-screen py-10 sm:py-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-xs uppercase tracking-[0.25em] font-bold text-[#8B1E3F]">
            Haute Couture Concierge
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[#1A1715]">
            Book a Private Video Consultation
          </h1>
          <div className="w-12 h-0.5 bg-[#C5A059] mx-auto mt-2"></div>
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed font-sans">
            Connect directly with our master drapers in Hyderabad. View live saree drapes, fabric close-ups in 4K, and custom blouse embroidery swatches from the comfort of your home.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Booking Form (7 Cols) */}
          <div className="lg:col-span-7 bg-white border border-[#E6D5B8] rounded-3xl p-6 sm:p-10 shadow-xs">
            {isBooked ? (
              <div className="text-center py-10 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-serif font-bold text-stone-900">Virtual Appointment Scheduled!</h3>
                <p className="text-xs text-stone-600 max-w-md mx-auto">
                  A personal bridal stylist from our Hyderabad atelier has been allotted to you. You will receive a WhatsApp calendar invite and Zoom/Google Meet link on <strong>{phone}</strong>.
                </p>
                <button
                  onClick={() => setIsBooked(false)}
                  className="bg-[#8B1E3F] text-white text-xs uppercase font-semibold px-6 py-2.5 rounded-lg"
                >
                  Book Another Session
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitAppointment} className="space-y-4 text-xs">
                <h3 className="font-serif font-bold text-base text-stone-900 flex items-center gap-2 mb-4">
                  <Video className="w-4 h-4 text-[#8B1E3F]" /> Reserve 1-on-1 Styling Video Slot
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Your Full Name *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Pooja Reddy"
                      className="w-full p-2.5 bg-[#FAF7F2] border border-[#E6D5B8] rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-stone-700 block mb-1">WhatsApp Phone Number *</label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98490 12345"
                      className="w-full p-2.5 bg-[#FAF7F2] border border-[#E6D5B8] rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="pooja.reddy@example.com"
                    className="w-full p-2.5 bg-[#FAF7F2] border border-[#E6D5B8] rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Preferred Date *</label>
                    <input
                      type="date"
                      required
                      value={preferredDate}
                      onChange={(e) => setPreferredDate(e.target.value)}
                      className="w-full p-2.5 bg-[#FAF7F2] border border-[#E6D5B8] rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Preferred Time Slot *</label>
                    <select
                      value={preferredTime}
                      onChange={(e) => setPreferredTime(e.target.value)}
                      className="w-full p-2.5 bg-[#FAF7F2] border border-[#E6D5B8] rounded-lg font-semibold text-stone-800"
                    >
                      <option value="11:30 AM IST">11:30 AM IST (Morning)</option>
                      <option value="02:30 PM IST">02:30 PM IST (Afternoon)</option>
                      <option value="05:30 PM IST">05:30 PM IST (Evening)</option>
                      <option value="08:00 PM IST">08:00 PM IST (Global / US / UK)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">Occasion / Specific Requirements</label>
                  <input
                    type="text"
                    value={occasion}
                    onChange={(e) => setOccasion(e.target.value)}
                    placeholder="e.g., Muhurtham Silk Sarees, Velvet Bridal Lehenga, Custom Blouse Neckline"
                    className="w-full p-2.5 bg-[#FAF7F2] border border-[#E6D5B8] rounded-lg"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">Additional Notes</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any specific colors, themes, or budget preferences you would like the stylist to prepare..."
                    className="w-full p-2.5 bg-[#FAF7F2] border border-[#E6D5B8] rounded-lg"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full bg-[#8B1E3F] hover:bg-[#721C24] text-white text-xs uppercase tracking-widest font-bold py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <Calendar className="w-4 h-4" /> Confirm Virtual Video Appointment
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Atelier Contact Details & Direct WhatsApp (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#1A1715] text-white rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
              <span className="text-[11px] uppercase tracking-widest font-bold text-[#DFBF77]">
                Flagship Atelier & Boutique
              </span>

              <h3 className="text-xl sm:text-2xl font-serif font-bold text-[#FDFBF7]">
                Miyapur Boutique Hyderabad
              </h3>

              <div className="space-y-4 text-xs text-[#EFE7DA]/85 font-sans">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-[#DFBF77] shrink-0 mt-0.5" />
                  <span>
                    Main Flagship: Plot 88, Road No. 36, Jubilee Hills & Miyapur Main Corridor, Hyderabad, Telangana 500049
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-[#DFBF77] shrink-0" />
                  <span>+91 98490 88219 / +91 40 2341 8900</span>
                </div>

                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-[#DFBF77] shrink-0" />
                  <span>couture@miyapurboutique.com</span>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-[#DFBF77] shrink-0" />
                  <span>Monday – Sunday: 10:00 AM – 8:30 PM IST</span>
                </div>
              </div>

              <div className="pt-4 border-t border-white/15">
                <a
                  href="https://wa.me/919849088219"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-[#25D366] hover:bg-[#1EBE5D] text-white text-xs uppercase font-bold tracking-wider py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all text-center block"
                >
                  <Phone className="w-4 h-4" /> Instant WhatsApp Concierge
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
