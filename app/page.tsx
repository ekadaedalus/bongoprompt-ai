"use client";
import { useEffect, useRef, useState } from 'react';
import AuthModal, { type User } from './components/AuthModal';
import ProgressChecklist, { type PlanStep } from './components/ProgressChecklist';
import UnderstoodChips from './components/UnderstoodChips';
import BudgetBar, { BUDGET_BAR_PADDING } from './components/BudgetBar';
import MicButton from './components/MicButton';
import SourceTag from './components/SourceTag';
import WeatherStrip from './components/WeatherStrip';
import DestinationHeader from './components/DestinationHeader';
import HotelsMap from './components/HotelsMap';
import TripPass from './components/TripPass';
import MyTrips from './components/MyTrips';
import BecomeGuideModal from './components/BecomeGuideModal';
import GuideReviewModal from './components/GuideReviewModal';
import type { DestinationInfo, Hotel, ItineraryDay, LocalGuide, PlanEvent, TransportOption, TripRecord, TripRequest, Weather } from '@/lib/types';
import { readPlanStream } from '@/lib/planStream';
import { taka } from '@/lib/format';

const EXAMPLE_PROMPTS = [
  "Sajek weekend under ৳8k",
  "Sylhet tea gardens with family",
  "Sundarbans 3 days",
  "কক্সবাজার ২ দিন, বাজেট ১৫০০০",
];

type Step = 'transport' | 'hotels' | 'checkout' | 'guide_prompt' | 'guide_list' | 'success';

/** A train with a different seat class picked: update its price and booking link. */
function withFareClass(option: TransportOption, cls: string): TransportOption {
  const fare = option.fares?.find((f) => f.cls === cls);
  if (!fare) return option;
  let booking_url = option.booking_url;
  if (booking_url) {
    const url = new URL(booking_url);
    url.searchParams.set('class', cls);
    booking_url = url.toString();
  }
  return { ...option, price: fare.fare, fare_class: cls, booking_url };
}

const STEP_BAR: { label: string; steps: Step[]; color: string }[] = [
  { label: 'Transport', steps: ['transport'], color: 'bg-blue-600' },
  { label: 'Hotels', steps: ['hotels'], color: 'bg-purple-600' },
  { label: 'Checkout', steps: ['checkout'], color: 'bg-green-600' },
  { label: 'Guide', steps: ['guide_prompt', 'guide_list'], color: 'bg-pink-600' },
  { label: 'Done', steps: ['success'], color: 'bg-emerald-600' },
];

const BOOK_SITE: Record<TransportOption['type'], string> = {
  Train: 'Bangladesh Railway',
  Bus: 'Shohoz',
  Flight: 'airline site',
};

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [planSteps, setPlanSteps] = useState<PlanStep[]>([]);

  // Plan data, filled in as the stream delivers it.
  const [request, setRequest] = useState<TripRequest | null>(null);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [transportOptions, setTransportOptions] = useState<TransportOption[]>([]);
  const [trains, setTrains] = useState<TransportOption[]>([]);
  const [trainClass, setTrainClass] = useState<Record<string, string>>({});
  const [guides, setGuides] = useState<LocalGuide[]>([]);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [destinationInfo, setDestinationInfo] = useState<DestinationInfo | null>(null);
  const [itinerary, setItinerary] = useState<ItineraryDay[]>([]);

  // The saved plan shown on the success screen (also reopened from "My trips").
  const [confirmedTrip, setConfirmedTrip] = useState<TripRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [myTripsOpen, setMyTripsOpen] = useState(false);
  const [guideHours, setGuideHours] = useState(4);

  // Verified guides for this destination; sample guides are only shown when there are none.
  const [registeredGuides, setRegisteredGuides] = useState<LocalGuide[]>([]);
  const [becomeGuideOpen, setBecomeGuideOpen] = useState(false);
  const [guideReviewOpen, setGuideReviewOpen] = useState(false);
  const [guidesVersion, setGuidesVersion] = useState(0);

  const [step, setStep] = useState<Step>('transport');
  const [selectedTransport, setSelectedTransport] = useState<TransportOption | null>(null);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [selectedGuide, setSelectedGuide] = useState<LocalGuide | null>(null);
  const [expandedGuideId, setExpandedGuideId] = useState<string | null>(null);
  const [transportFilter, setTransportFilter] = useState<'All' | 'Bus' | 'Train' | 'Flight'>('All');

  // Hotel details modal
  const [hotelModalOpen, setHotelModalOpen] = useState(false);
  const [viewingHotel, setViewingHotel] = useState<Hotel | null>(null);

  // Guest mode: everyone browses freely; logging in is only needed to save a plan or become a guide.
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  // Why the login modal is open, so we can carry on with that action once the traveller is signed in.
  const [authPurpose, setAuthPurpose] = useState<null | 'login' | 'confirm' | 'save' | 'guide'>(null);
  const pendingGuide = useRef<LocalGuide | null>(null);

  // Ignore events from a superseded search if the traveller starts another one.
  const searchId = useRef(0);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => setUser(d.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true));
  }, []);

  const guideCity = request?.destination ?? null;
  useEffect(() => {
    if (step !== 'guide_list' || !user || !guideCity) return;
    let cancelled = false;
    fetch(`/api/guides?city=${encodeURIComponent(guideCity)}`)
      .then((r) => (r.ok ? r.json() : { guides: [] }))
      .then((d) => { if (!cancelled) setRegisteredGuides(d.guides ?? []); })
      .catch(() => { if (!cancelled) setRegisteredGuides([]); });
    return () => { cancelled = true; };
  }, [step, user, guideCity, guidesVersion]);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  };

  const clearSelections = () => {
    setStep('transport');
    setSelectedTransport(null);
    setSelectedHotel(null);
    setSelectedGuide(null);
    setExpandedGuideId(null);
    setGuideHours(4);
    setTransportFilter('All');
    setHotelModalOpen(false);
    setViewingHotel(null);
    setConfirmedTrip(null);
  };

  /** Clear everything the planner returned (keeps `request` so the chips stay up during a re-run). */
  const clearResults = () => {
    setHotels([]);
    setTransportOptions([]);
    setTrains([]);
    setTrainClass({});
    setGuides([]);
    setWeather(null);
    setDestinationInfo(null);
    setItinerary([]);
    setRegisteredGuides([]);
    setPlanSteps([]);
  };

  const clearPlan = () => {
    setRequest(null);
    clearResults();
  };

  const resetApp = () => {
    searchId.current++;
    setIsLoading(false);
    setPrompt("");
    clearPlan();
    clearSelections();
  };

  const handleEvent = (e: PlanEvent) => {
    switch (e.type) {
      case 'steps':
        setPlanSteps(e.steps.map((s) => ({ ...s, status: 'pending' })));
        break;
      case 'step':
        setPlanSteps((prev) => prev.map((s) => (s.id === e.id ? { ...s, status: e.status } : s)));
        break;
      case 'request':
        setRequest(e.request);
        break;
      case 'hotels':
        setHotels(e.hotels);
        break;
      case 'transport':
        setTransportOptions(e.options);
        break;
      case 'trains':
        setTrains(e.options);
        break;
      case 'guides':
        setGuides(e.guides);
        break;
      case 'weather':
        setWeather(e.weather);
        break;
      case 'destination':
        setDestinationInfo(e.info);
        break;
      case 'itinerary':
        setItinerary(e.days);
        break;
      case 'error':
        alert(e.message);
        break;
    }
  };

  /** Run the planner. `body` is { prompt } for a new search or { request } for an edited re-run. */
  const runPlan = async (body: { prompt: string } | { request: Partial<TripRequest> }) => {
    const id = ++searchId.current;
    setIsLoading(true);
    clearSelections();
    clearResults();
    if ('prompt' in body) setRequest(null);

    try {
      const response = await fetch('/api/parse-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null);
        alert(data?.error || "Something went wrong. Please try again.");
        return;
      }
      await readPlanStream(response, (e) => {
        if (id === searchId.current) handleEvent(e);
      });
    } catch (error) {
      console.error("Fetch Error:", error);
      if (id === searchId.current) alert("Could not reach the planner. Please check your connection and try again.");
    } finally {
      if (id === searchId.current) setIsLoading(false);
    }
  };

  const handleSearch = () => {
    if (!prompt.trim() || isLoading) return;
    runPlan({ prompt });
  };

  // Open hotel details modal
  const openHotelModal = (hotel: Hotel) => {
    setViewingHotel(hotel);
    setHotelModalOpen(true);
  };

  // Select hotel and proceed to checkout
  const selectHotelAndContinue = (hotel: Hotel) => {
    setSelectedHotel(hotel);
    setHotelModalOpen(false);
    setStep('checkout');
  };

  const showResults = !!request && !isLoading;
  // Real trains first, then AI-estimated buses and flights.
  const rides = [...trains.map((t) => (trainClass[t.id] ? withFareClass(t, trainClass[t.id]) : t)), ...transportOptions];
  const nights = request?.nights || 1;
  const travellers = request?.travellers || 1;
  const transportCost = (selectedTransport?.price || 0) * travellers;
  const hotelCost = selectedHotel?.stayTotal ?? 0;
  const showingSampleGuides = registeredGuides.length === 0;
  const shownGuides = showingSampleGuides ? guides : registeredGuides;
  // While browsing guides, the open guide's estimate previews in the budget bar.
  const previewGuide = selectedGuide ?? (step === 'guide_list' ? shownGuides.find((g) => g.id === expandedGuideId) ?? null : null);
  const guideCost = previewGuide ? previewGuide.hourly_rate * guideHours : 0;
  // Checkout and the trip pass already show the total, so the bar is hidden there.
  const showBudgetBar = showResults && step !== 'checkout' && step !== 'success';

  /** Save the plan (the server generates the trip ID once, here) and show the trip pass. */
  const confirmTrip = async (guide: LocalGuide | null, signedIn = !!user) => {
    if (!request || !selectedTransport || !selectedHotel || saving) return;
    if (!signedIn) {
      // e.g. logged out mid-flow: sign in, then save with the same choices.
      pendingGuide.current = guide;
      setAuthPurpose('save');
      return;
    }
    setSelectedGuide(guide);
    const guideTotal = guide ? guide.hourly_rate * guideHours : 0;
    setSaving(true);
    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request,
          transport: selectedTransport,
          hotel: selectedHotel,
          guide,
          guideHours: guide ? guideHours : 0,
          costs: { transport: transportCost, hotel: hotelCost, guide: guideTotal, total: transportCost + hotelCost + guideTotal },
          itinerary,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Could not save your trip. Please try again.');
        return;
      }
      setConfirmedTrip(data.trip);
      setStep('success');
    } catch {
      alert('Could not reach the server. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  /** Checkout's "Confirm plan": guests log in first, then carry on to the guide step. */
  const confirmPlan = () => {
    if (user) setStep('guide_prompt');
    else setAuthPurpose('confirm');
  };

  const openBecomeGuide = () => {
    if (user) setBecomeGuideOpen(true);
    else setAuthPurpose('guide');
  };

  /** After logging in or signing up, finish whatever the traveller was doing. Selections are untouched. */
  const handleAuthenticated = (u: User) => {
    setUser(u);
    const purpose = authPurpose;
    setAuthPurpose(null);
    if (purpose === 'confirm') setStep('guide_prompt');
    else if (purpose === 'save') confirmTrip(pendingGuide.current, true);
    else if (purpose === 'guide') setBecomeGuideOpen(true);
  };

  const AUTH_COPY = {
    login: { title: 'Log in to BongoPrompt', subtitle: 'Log in to save trips and register as a guide.' },
    confirm: { title: 'Log in to save your plan', subtitle: 'Your ride, hotel and budget stay just as you picked them.' },
    save: { title: 'Log in to save your plan', subtitle: 'Your ride, hotel and budget stay just as you picked them.' },
    guide: { title: 'Log in to become a guide', subtitle: 'Your guide profile is linked to your account.' },
  } as const;

  return (
    <main className={`relative flex min-h-screen flex-col items-center justify-center text-white p-4 pt-20 md:p-8 md:pt-20 overflow-x-hidden ${showBudgetBar ? BUDGET_BAR_PADDING : ''}`}>
      {/* Beach Background Image */}
      <div className="fixed inset-0 z-0">
        <img
          src="/beach-background.png"
          alt="Beach Background"
          className="w-full h-full object-cover"
        />
        {/* Dark overlay for better text readability */}
        <div className="absolute inset-0 bg-black/40"></div>
      </div>

      {/* Become a guide + account status */}
      {authChecked && (
        <div className="fixed top-4 right-4 left-4 z-20 flex flex-wrap items-center justify-end gap-x-4 gap-y-2 pointer-events-none [&>*]:pointer-events-auto">
        <button
          onClick={openBecomeGuide}
          className="text-white text-sm font-semibold hover:underline whitespace-nowrap"
          style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.8)' }}
        >
          🧭 Become a guide
        </button>
        {user?.isAdmin && (
          <button
            onClick={() => setGuideReviewOpen(true)}
            className="text-white text-sm font-semibold hover:underline whitespace-nowrap"
            style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.8)' }}
          >
            🛡️ Review guides
          </button>
        )}
        <div className="flex items-center gap-2 bg-white/90 backdrop-blur-md rounded-full pl-4 pr-1.5 py-1.5 shadow-xl border-2 border-white/50 text-sm">
          {user ? (
            <>
              <span className="text-slate-700 font-semibold">👋 {user.name.split(' ')[0]}</span>
              <button onClick={() => setMyTripsOpen(true)} className="px-3 py-1 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold transition-all">
                🧳 My trips
              </button>
              <button onClick={logout} className="px-3 py-1 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold transition-all">
                Log out
              </button>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden="true"></span>
              <span className="text-slate-600 font-semibold">Guest mode ·</span>
              <button onClick={() => setAuthPurpose('login')} className="px-3 py-1 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold transition-all">
                Log in
              </button>
            </>
          )}
        </div>
        </div>
      )}

      <div className="relative z-10 w-full max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1
            className="text-6xl md:text-8xl font-bold mb-4 text-white cursor-pointer drop-shadow-2xl"
            onClick={resetApp}
            style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.8)' }}
          >
            BongoPrompt
          </h1>
          <p
            className="text-xl md:text-2xl text-white/90 font-light"
            style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.8)' }}
          >
            Prompt-Driven Travel Planning &amp; Auto-Budgeting Platform
          </p>
        </div>

        {/* Search Bar */}
        {!request && step !== 'success' && (
          <div className="relative w-full max-w-3xl mx-auto mb-10 group">
            <div className="relative flex items-center">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="e.g., I am in Dhaka and want to go to Cox's Bazar for 2 days with a 15000 taka budget..."
                className="w-full px-6 py-5 pr-56 text-lg rounded-2xl bg-white/95 backdrop-blur-xl text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-4 focus:ring-blue-400/50 shadow-2xl border-2 border-white/50"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <MicButton onText={setPrompt} />
                <button
                  onClick={handleSearch}
                  disabled={isLoading}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-lg disabled:opacity-50 transition-all"
                >
                  Explore
                </button>
              </div>
            </div>
            {!isLoading && (
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {EXAMPLE_PROMPTS.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setPrompt(example)}
                    className="px-4 py-1.5 rounded-full text-sm font-semibold bg-white/90 text-slate-700 hover:bg-white shadow-lg border-2 border-white/50 transition-all"
                  >
                    ✨ {example}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* What we understood (editable) */}
        {request && step !== 'success' && (
          <UnderstoodChips request={request} disabled={isLoading} onRerun={(edited) => runPlan({ request: edited })} />
        )}

        {/* Live progress while planning */}
        {isLoading && planSteps.length > 0 && <ProgressChecklist steps={planSteps} />}

        {/* Progress Steps */}
        {(showResults || step === 'success') && (
          <div className="flex justify-center mb-8">
            <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2 bg-white/90 backdrop-blur-md p-2 rounded-3xl sm:rounded-full border-2 border-white/50 shadow-xl">
              {STEP_BAR.map((s, i) => {
                const current = STEP_BAR.findIndex((b) => b.steps.includes(step));
                return (
                  <div key={s.label} className="flex items-center gap-1 sm:gap-2">
                    {i > 0 && <div className="text-slate-400">→</div>}
                    <div className={`px-3 sm:px-4 py-1.5 rounded-full text-sm font-bold transition-all ${
                      i === current ? `${s.color} text-white` : i < current ? 'text-green-600' : 'text-slate-600'
                    }`}>
                      {i < current ? '✓' : `${i + 1}.`} {s.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 1: TRANSPORT */}
        {showResults && step === 'transport' && (
          <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            {(destinationInfo || weather) && (
              <div className="grid gap-4 mb-8">
                {destinationInfo && <DestinationHeader info={destinationInfo} />}
                {weather && <WeatherStrip weather={weather} />}
              </div>
            )}
            <h2 className="text-3xl font-bold mb-6 text-center text-white" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
              Available Rides from {request.origin ?? '…'} to {request.destination}
            </h2>
            {request.needs_origin ? (
              <div className="text-center py-12 bg-yellow-500/90 rounded-2xl border-2 border-yellow-400 shadow-xl">
                <p className="text-white text-lg font-bold">❓ Please tell me where you are starting from!</p>
                <p className="text-white/90 text-sm mt-1">Click the 📍 chip above to add it.</p>
              </div>
            ) : (
              <>
                <div className="flex justify-center gap-3 mb-8">
                  {(['All', 'Bus', 'Train', 'Flight'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setTransportFilter(type)}
                      className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${
                        transportFilter === type
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                          : 'bg-white/90 text-slate-700 hover:bg-white'
                      }`}
                    >
                      {type === 'All' ? '🔍 All' : type === 'Bus' ? '🚌 Bus' : type === 'Train' ? '🚆 Train' : '✈️ Flight'}
                    </button>
                  ))}
                </div>
                <div className="space-y-4">
                  {rides.filter(opt => transportFilter === 'All' ? true : opt.type === transportFilter).length === 0 && (
                    <div className="text-center py-10 bg-white/95 rounded-2xl border-2 border-white/50 shadow-xl text-slate-600 font-semibold">
                      {transportFilter === 'Train'
                        ? `No Bangladesh Railway trains between ${request.origin} and ${request.destination} on ${new Date(`${request.checkinDate}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long' })}.`
                        : 'No rides found for this filter.'}
                    </div>
                  )}
                  {rides.filter(opt => transportFilter === 'All' ? true : opt.type === transportFilter).map((option) => {
                    const rideTotal = option.price * travellers;
                    const withinBudget = option.price > 0 && request.transport_budget !== null && rideTotal <= request.transport_budget;
                    return (
                      <div key={option.id} className="bg-white/95 backdrop-blur-xl rounded-2xl border-2 border-white/50 p-6 shadow-xl hover:shadow-2xl transition-all duration-300">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div className="flex items-start gap-4 flex-1">
                            <div className={`w-14 h-14 rounded-full flex-shrink-0 flex items-center justify-center text-2xl ${
                              option.type === 'Flight' ? 'bg-blue-100 text-blue-600' :
                              option.type === 'Train' ? 'bg-purple-100 text-purple-600' :
                              'bg-orange-100 text-orange-600'
                            }`}>
                              {option.type === 'Flight' ? '✈️' : option.type === 'Train' ? '🚆' : '🚌'}
                            </div>
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <h3 className="font-bold text-xl text-slate-800">{option.provider}</h3>
                                <SourceTag source={option.source} />
                                {withinBudget && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-green-500 text-white">
                                    ✓ Within budget
                                  </span>
                                )}
                              </div>
                              <p className="text-slate-600 text-sm font-medium mb-2">
                                {option.departure_time} → {option.arrival_time}
                                <span className="text-slate-500 ml-2">({option.duration})</span>
                              </p>
                              <div className="flex flex-col sm:flex-row gap-2 text-xs text-slate-600 bg-slate-100 p-2 rounded-lg">
                                <span>📍 Departs: <span className="font-semibold">{option.departure_station}</span></span>
                                <span> Arrives: <span className="font-semibold">{option.arrival_station}</span></span>
                              </div>
                              {option.type === 'Train' && (
                                <>
                                  {option.off_days && <p className="text-xs text-slate-500 mt-2">🗓️ {option.off_days}</p>}
                                  {option.fares && option.fares.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5 mt-2" role="radiogroup" aria-label="Seat class">
                                      {option.fares.map((f) => (
                                        <button
                                          key={f.cls}
                                          type="button"
                                          role="radio"
                                          aria-checked={option.fare_class === f.cls}
                                          onClick={() => setTrainClass((prev) => ({ ...prev, [option.id]: f.cls }))}
                                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border-2 transition-all ${
                                            option.fare_class === f.cls
                                              ? 'bg-purple-600 text-white border-purple-600'
                                              : 'bg-white text-slate-600 border-slate-200 hover:border-purple-400'
                                          }`}
                                        >
                                          {f.label} {taka(f.fare)}
                                        </button>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-slate-500 mt-2">Fare not listed for this route. Check on eticket.railway.gov.bd</p>
                                  )}
                                  <p className="text-[10px] text-slate-400 mt-1">Timetable &amp; fares from a public dataset; seat classes vary by train.</p>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="text-right w-full md:w-auto flex flex-row md:flex-col justify-between md:justify-center items-center md:items-end gap-2">
                            <div>
                              <p className="text-green-600 font-bold text-2xl">{option.price > 0 ? taka(option.price) : '—'}</p>
                              {travellers > 1 && option.price > 0 && <p className="text-slate-500 text-xs">per person · {taka(rideTotal)} for {travellers}</p>}
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                              <button
                                onClick={() => { setSelectedTransport(option); setStep('hotels'); }}
                                disabled={option.price <= 0}
                                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold px-5 py-2 rounded-xl transition-all text-sm shadow-lg disabled:opacity-50"
                              >
                                Select Ride
                              </button>
                              {option.booking_url && (
                                <a href={option.booking_url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                                  Book on {option.type === 'Flight' ? option.provider : BOOK_SITE[option.type]} ↗
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Route map: Google's no-key directions embed */}
                <div className="bg-white/95 backdrop-blur-xl rounded-2xl border-2 border-white/50 p-3 shadow-xl mt-6">
                  <h3 className="font-bold text-slate-800 px-1 mb-2">🗺️ Route: {request.origin} → {request.destination}</h3>
                  <div className="rounded-xl overflow-hidden h-72 bg-slate-100">
                    <iframe
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      loading="lazy"
                      allowFullScreen
                      src={`https://www.google.com/maps?saddr=${encodeURIComponent(`${request.origin}, Bangladesh`)}&daddr=${encodeURIComponent(`${request.destination}, Bangladesh`)}&output=embed`}
                      title="Route map"
                    ></iframe>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* STEP 2: HOTELS */}
        {showResults && step === 'hotels' && (
          <div className="w-full animate-in fade-in slide-in-from-right-8 duration-500">
            <button onClick={() => setStep('transport')} className="mb-4 text-white/90 hover:text-white text-sm flex items-center gap-1 font-semibold" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>
              ← Back to Transport
            </button>
            <h2 className="text-3xl font-bold mb-6 text-center text-white" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
              Hotels in {request.destination}
            </h2>
            <p className="text-center text-white/90 mb-6 text-sm" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>
              💡 Click on any hotel card to view details, amenities, and exact location on map
            </p>
            {hotels.length === 0 && (
              <div className="text-center py-12 bg-white/95 rounded-2xl border-2 border-white/50 shadow-xl text-slate-600 font-semibold">
                No hotels found on Agoda for these dates. Try different dates or a nearby town.
              </div>
            )}
            <HotelsMap hotels={hotels} onPick={openHotelModal} />
            <div className="grid gap-6 md:grid-cols-2">
              {hotels.map((hotel, index) => (
                <div
                  key={hotel.id}
                  onClick={() => openHotelModal(hotel)}
                  className="bg-white/95 backdrop-blur-xl rounded-2xl border-2 border-white/50 overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col cursor-pointer group"
                >
                  <div className="relative h-48 bg-slate-200 overflow-hidden">
                    {hotel.image ? (
                      <img src={hotel.image} alt={hotel.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500">No Image</div>
                    )}
                    <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
                      {hotel.isAvailable && (
                        <div className="px-3 py-1 rounded-full text-xs font-bold bg-green-500 text-white shadow-lg">
                          ✅ Available
                        </div>
                      )}
                      {hotel.overBudgetBy > 0 && (
                        <div className="px-3 py-1 rounded-full text-xs font-bold bg-red-500 text-white shadow-lg">
                          Over budget by {taka(hotel.overBudgetBy)}
                        </div>
                      )}
                    </div>
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 text-white text-xs font-bold flex items-center justify-center border-2 border-white shadow-lg">{index + 1}</span>
                      <SourceTag source="agoda" />
                    </div>
                    <div className="absolute bottom-3 left-3 px-3 py-1 rounded-full text-xs font-bold bg-blue-600/90 text-white shadow-lg flex items-center gap-1">
                      👁️ View Details & Map
                    </div>
                  </div>
                  <div className="p-5 flex flex-col flex-grow">
                    <h3 className="font-bold text-lg mb-2 text-slate-800 group-hover:text-purple-700 transition-colors">{hotel.name}</h3>
                    {hotel.starRating > 0 && (
                      <p className="text-yellow-500 text-sm mb-3">{'⭐'.repeat(hotel.starRating)}</p>
                    )}
                    {hotel.roomName && (
                      <p className="text-slate-600 text-sm mb-3">
                        🛏️ {hotel.roomName}
                        {hotel.rooms > 1 && <span className="font-semibold"> · {hotel.rooms} rooms</span>}
                        {hotel.occupancy ? ` · ${hotel.occupancy} guest${hotel.occupancy === 1 ? '' : 's'} per room` : ''}
                      </p>
                    )}
                    {hotel.bookingUrl && (
                      <a
                        href={hotel.bookingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 mb-3"
                      >
                        Book on Agoda ↗
                      </a>
                    )}
                    <div className="mt-auto flex justify-between items-center">
                      <div>
                        <p className="text-green-600 font-bold text-xl">
                          {taka(hotel.price)}
                          <span className="text-sm text-slate-600 font-normal"> / night{hotel.rooms > 1 ? ' per room' : ''}</span>
                        </p>
                        <p className="text-slate-500 text-xs">{taka(hotel.stayTotal)} for the stay</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          selectHotelAndContinue(hotel);
                        }}
                        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold px-4 py-2 rounded-lg transition-all text-sm shadow-lg"
                      >
                        Select & Continue →
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: CHECKOUT */}
        {showResults && step === 'checkout' && selectedTransport && selectedHotel && (
          <div className="w-full max-w-2xl mx-auto animate-in fade-in slide-in-from-right-8 duration-500">
            <button onClick={() => setStep('hotels')} className="mb-4 text-white/90 hover:text-white text-sm flex items-center gap-1 font-semibold" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>
              ← Back to Hotels
            </button>
            <h2 className="text-3xl font-bold mb-6 text-center text-white" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
              🧾 Checkout & Confirm
            </h2>
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl border-2 border-white/50 p-6 space-y-6 shadow-2xl">
              <div className="flex justify-between items-center border-b-2 border-slate-200 pb-4">
                <div>
                  <p className="text-slate-600 text-sm font-semibold">Transport{travellers > 1 ? ` (${taka(selectedTransport.price)} × ${travellers})` : ''}</p>
                  <p className="font-bold text-lg text-slate-800">{selectedTransport.type} - {selectedTransport.provider}</p>
                </div>
                <p className="font-bold text-xl text-slate-800">{taka(transportCost)}</p>
              </div>
              <div className="flex justify-between items-center border-b-2 border-slate-200 pb-4">
                <div>
                  <p className="text-slate-600 text-sm font-semibold">Hotel ({taka(selectedHotel.price)} × {nights} night{nights === 1 ? '' : 's'}{selectedHotel.rooms > 1 ? ` × ${selectedHotel.rooms} rooms` : ''})</p>
                  <p className="font-bold text-lg text-slate-800">{selectedHotel.name}</p>
                </div>
                <p className="font-bold text-xl text-slate-800">{taka(hotelCost)}</p>
              </div>
              <div className="flex justify-between items-center pt-2">
                <p className="text-2xl font-bold text-slate-800">Total Estimated Cost</p>
                <p className="text-3xl font-bold text-green-600">{taka(transportCost + hotelCost)}</p>
              </div>
              <div className="bg-slate-50 rounded-xl border-2 border-slate-200 p-4">
                <p className="text-sm font-bold text-slate-700 mb-1">🎟️ Book directly with the provider</p>
                <p className="text-xs text-slate-500 mb-3">BongoPrompt plans your trip; payment and tickets happen on the provider&apos;s own site.</p>
                <div className="flex flex-wrap gap-2">
                  {selectedTransport.booking_url && (
                    <a href={selectedTransport.booking_url} target="_blank" rel="noopener noreferrer"
                      className="px-4 py-2 rounded-lg bg-white border-2 border-slate-200 hover:border-purple-400 text-sm font-bold text-slate-700 transition-colors">
                      {selectedTransport.type === 'Train' ? '🚆' : selectedTransport.type === 'Flight' ? '✈️' : '🚌'} Book on {selectedTransport.type === 'Flight' ? selectedTransport.provider : BOOK_SITE[selectedTransport.type]} ↗
                    </a>
                  )}
                  {selectedHotel.bookingUrl && (
                    <a href={selectedHotel.bookingUrl} target="_blank" rel="noopener noreferrer"
                      className="px-4 py-2 rounded-lg bg-white border-2 border-slate-200 hover:border-purple-400 text-sm font-bold text-slate-700 transition-colors">
                      🏨 Book on Agoda ↗
                    </a>
                  )}
                </div>
              </div>
              <button
                onClick={confirmPlan}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-4 rounded-xl text-lg shadow-lg transition-all"
              >
                Confirm plan
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: GUIDE PROMPT */}
        {showResults && step === 'guide_prompt' && (
          <div className="w-full max-w-2xl mx-auto animate-in zoom-in-95 duration-500">
            <div className="bg-white/95 backdrop-blur-xl rounded-3xl border-2 border-white/50 p-10 text-center shadow-2xl">
              <div className="text-6xl mb-6">🧭</div>
              <h2 className="text-3xl font-bold mb-4 text-slate-800">Do you need a local guide?</h2>
              <p className="text-slate-600 mb-8 text-lg">
                Explore {request.destination} like a local with someone who knows it well.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => setStep('guide_list')}
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-xl text-lg shadow-lg transition-all"
                >
                  Yes, Show Guides
                </button>
                <button
                  onClick={() => confirmTrip(null)}
                  disabled={saving}
                  className="px-8 py-4 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-lg border-2 border-slate-300 transition-all disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'No, Thanks'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: GUIDE LIST */}
        {showResults && step === 'guide_list' && (
          <div className="w-full max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <button onClick={() => setStep('guide_prompt')} className="mb-4 text-white/90 hover:text-white text-sm flex items-center gap-1 font-semibold" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>
              ← Back
            </button>
            <h2 className="text-3xl font-bold mb-2 text-center text-white" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
              Local Guides in {request.destination}
            </h2>
            <p className="text-center text-white/90 mb-4 text-sm" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>
              Click a guide to see details. Cost is separate from your booking.
            </p>
            {showingSampleGuides && (
              <div className="mb-6 text-center bg-amber-50/95 rounded-2xl border-2 border-amber-200 px-5 py-3 shadow-xl">
                <p className="text-amber-800 font-bold text-sm">🚧 Sample guides, launching soon</p>
                <p className="text-amber-700 text-xs mt-0.5">
                  There are no verified guides in {request.destination} yet. These profiles are AI-written examples, not real people. Requesting one adds an estimate to your plan only.
                </p>
              </div>
            )}

            <div className="space-y-4">
              {shownGuides.map((guide) => (
                <div key={guide.id} className="bg-white/95 backdrop-blur-xl rounded-2xl border-2 border-white/50 overflow-hidden shadow-xl transition-all duration-300">
                  <div
                    onClick={() => setExpandedGuideId(expandedGuideId === guide.id ? null : guide.id)}
                    className="p-5 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xl font-bold text-white">
                        {guide.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-lg text-slate-800">{guide.name}</h3>
                          {guide.kind === 'registered'
                            ? <SourceTag source="bongoprompt" />
                            : <SourceTag source="ai" label="Sample · launching soon" />}
                        </div>
                        <p className="text-purple-600 text-sm font-semibold">
                          {guide.specialty}
                          {guide.kind === 'registered' && !!guide.experience_years && ` · ${guide.experience_years} yr${guide.experience_years === 1 ? '' : 's'} guiding`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {guide.rating && <p className="text-yellow-500 text-sm font-bold">⭐ {guide.rating}</p>}
                      <p className="text-slate-500 text-xs">
                        {expandedGuideId === guide.id ? 'Click to collapse' : 'Click to expand'}
                      </p>
                    </div>
                  </div>

                  {expandedGuideId === guide.id && (
                    <div className="p-5 pt-0 border-t-2 border-slate-200 bg-slate-50 animate-in slide-in-from-top-2 duration-300">
                      <p className="text-slate-700 mb-4 italic">&ldquo;{guide.bio}&rdquo;</p>
                      {guide.kind === 'registered' && (
                        <p className="text-green-700 text-xs font-semibold mb-4">✓ Identity checked by BongoPrompt against this guide&apos;s national ID.</p>
                      )}
                      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="bg-white px-4 py-2 rounded-lg border-2 border-slate-200 shadow-sm">
                          <p className="text-slate-600 text-xs font-semibold">Rate</p>
                          <p className="text-green-600 font-bold text-xl">
                            {taka(guide.hourly_rate)}
                            <span className="text-sm text-slate-600 font-normal"> / hour</span>
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <label htmlFor={`hours-${guide.id}`} className="text-slate-600 text-xs font-semibold">Hours</label>
                            <select
                              id={`hours-${guide.id}`}
                              value={guideHours}
                              onChange={(e) => setGuideHours(Number(e.target.value))}
                              className="px-2 py-1 rounded-lg border-2 border-slate-200 text-slate-800 text-sm font-bold focus:outline-none focus:border-purple-500"
                            >
                              {[2, 3, 4, 5, 6, 8, 10, 12].map((h) => <option key={h} value={h}>{h}</option>)}
                            </select>
                          </div>
                          <p className="text-slate-700 text-sm font-semibold mt-1">
                            {taka(guide.hourly_rate)} × {guideHours} h = <span className="text-green-600 font-bold">{taka(guide.hourly_rate * guideHours)}</span>
                          </p>
                          <p className="text-slate-500 text-[10px]">*Added to your trip total</p>
                        </div>
                        <button
                          onClick={() => confirmTrip(guide)}
                          disabled={saving}
                          className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold px-6 py-2.5 rounded-xl transition-all shadow-lg disabled:opacity-50"
                        >
                          {saving ? 'Saving…' : `Request ${guide.name.split(' ')[0]}`}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="text-center mt-6">
              <button
                onClick={() => confirmTrip(null)}
                disabled={saving}
                className="text-white/90 hover:text-white text-sm underline font-semibold disabled:opacity-50"
                style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}
              >
                Skip guide and finish my plan
              </button>
            </div>
          </div>
        )}

        {/* STEP 6: SUCCESS — the saved trip pass */}
        {step === 'success' && confirmedTrip && <TripPass trip={confirmedTrip} onHome={resetApp} />}
      </div>

      {/* 💰 Running budget, visible while choosing */}
      {showBudgetBar && (
        <BudgetBar
          budget={request.total_budget}
          items={[
            { label: '🚌 Ride', amount: transportCost },
            { label: '🏨 Hotel', amount: hotelCost },
            { label: '🧭 Guide', amount: guideCost },
          ]}
        />
      )}

      {/* 🧳 MY TRIPS */}
      {myTripsOpen && user && (
        <MyTrips
          onClose={() => setMyTripsOpen(false)}
          onOpen={(trip) => {
            searchId.current++;
            setIsLoading(false);
            clearPlan();
            clearSelections();
            setConfirmedTrip(trip);
            setStep('success');
            setMyTripsOpen(false);
          }}
        />
      )}

      {/* 🧭 BECOME A GUIDE */}
      {becomeGuideOpen && user && (
        <BecomeGuideModal
          defaultName={user.name}
          defaultCity={request?.destination ?? ''}
          onClose={() => setBecomeGuideOpen(false)}
          onSaved={() => setGuidesVersion((v) => v + 1)}
        />
      )}

      {/* 🛡️ ADMIN: REVIEW GUIDE APPLICATIONS */}
      {guideReviewOpen && user?.isAdmin && (
        <GuideReviewModal
          onClose={() => setGuideReviewOpen(false)}
          onReviewed={() => setGuidesVersion((v) => v + 1)}
        />
      )}

      {/* 🔐 LOGIN / CREATE ACCOUNT — shown to guests when the local guide step is reached */}
      {authPurpose && !user && (
        <AuthModal
          title={AUTH_COPY[authPurpose].title}
          subtitle={AUTH_COPY[authPurpose].subtitle}
          cancelLabel="Close"
          onAuthenticated={handleAuthenticated}
          onCancel={() => setAuthPurpose(null)}
        />
      )}

      {/* 🗺️ HOTEL DETAILS MODAL WITH MAP */}
      {hotelModalOpen && viewingHotel && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
          onClick={() => setHotelModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header / Image */}
            <div className="relative h-64 md:h-80 w-full">
              {viewingHotel.image && (
                <img src={viewingHotel.image} alt={viewingHotel.name} className="w-full h-full object-cover rounded-t-3xl" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent rounded-t-3xl"></div>
              <button
                onClick={() => setHotelModalOpen(false)}
                className="absolute top-4 right-4 bg-black/50 hover:bg-black/80 text-white rounded-full p-2 transition-colors backdrop-blur-md"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="absolute bottom-6 left-6 right-6">
                <h2 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">{viewingHotel.name}</h2>
                <div className="flex items-center gap-3 flex-wrap">
                  {viewingHotel.starRating > 0 && (
                    <span className="text-yellow-400 drop-shadow-md">{'⭐'.repeat(viewingHotel.starRating)}</span>
                  )}
                  {viewingHotel.isAvailable && (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-500 text-white">✅ Available</span>
                  )}
                  <span className="text-white/90 text-sm drop-shadow-md flex items-center gap-1">
                    📍 {viewingHotel.fullAddress || viewingHotel.location}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 md:p-8 space-y-6">

              {/* Price & Book Button */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50 p-6 rounded-2xl border-2 border-slate-200">
                <div>
                  <p className="text-slate-600 text-sm font-semibold">Starting from</p>
                  <p className="text-green-600 font-bold text-3xl">
                    {taka(viewingHotel.price)}
                    <span className="text-sm text-slate-600 font-normal"> / night</span>
                  </p>
                </div>
                <div className="mt-4 md:mt-0 flex flex-col items-stretch md:items-end gap-2">
                  <button
                    onClick={() => selectHotelAndContinue(viewingHotel)}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold px-8 py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    Add to my plan →
                  </button>
                  {viewingHotel.bookingUrl && (
                    <a href={viewingHotel.bookingUrl} target="_blank" rel="noopener noreferrer"
                      className="text-sm font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center justify-center gap-1">
                      Book on Agoda
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>

              {/* Amenities */}
              {viewingHotel.amenities && viewingHotel.amenities.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold mb-4 text-slate-800">🏨 Top Amenities</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {viewingHotel.amenities.map((amenity, i) => (
                      <div key={i} className="flex items-center gap-2 text-slate-700 bg-white p-3 rounded-lg border-2 border-slate-200 hover:border-purple-400 transition-colors">
                        <span className="text-purple-600 font-bold">✓</span>
                        <span className="text-sm">{amenity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Interactive Map */}
              <div>
                <h3 className="text-xl font-bold mb-4 text-slate-800">📍 Exact Location</h3>
                <div className="rounded-2xl overflow-hidden border-2 border-slate-200 h-72 bg-slate-100">
                  {viewingHotel.latitude && viewingHotel.longitude ? (
                    <iframe
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      loading="lazy"
                      allowFullScreen
                      src={`https://www.google.com/maps?q=${viewingHotel.latitude},${viewingHotel.longitude}&z=15&output=embed`}
                      title="Hotel Location Map"
                    ></iframe>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                      <p className="text-lg font-semibold mb-2"> {viewingHotel.fullAddress || viewingHotel.location}</p>
                      <p className="text-sm">Map coordinates not available for this property</p>
                    </div>
                  )}
                </div>
                {viewingHotel.latitude && viewingHotel.longitude && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${viewingHotel.latitude},${viewingHotel.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-semibold transition-colors bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-100"
                  >
                    🗺️ Open in Google Maps
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
