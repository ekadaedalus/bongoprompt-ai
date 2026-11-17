import type { DestinationInfo } from "@/lib/types";
import SourceTag from "./SourceTag";

/** Destination photo and a two-sentence intro from Wikipedia, shown above the results. */
export default function DestinationHeader({ info }: { info: DestinationInfo }) {
  return (
    <div className="bg-white/95 backdrop-blur-xl rounded-2xl border-2 border-white/50 overflow-hidden shadow-xl flex flex-col sm:flex-row">
      {info.image && (
        // eslint-disable-next-line @next/next/no-img-element -- remote Wikimedia thumbnail
        <img src={info.image} alt={info.title} className="w-full sm:w-48 h-40 sm:h-auto object-cover flex-shrink-0" />
      )}
      <div className="p-5 flex flex-col justify-center">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <h3 className="font-bold text-xl text-slate-800">📍 {info.title}</h3>
          <SourceTag source="wikipedia" />
        </div>
        <p className="text-slate-600 text-sm leading-relaxed line-clamp-3">{info.extract}</p>
        <a href={info.url} target="_blank" rel="noopener noreferrer" className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800">
          Read more on Wikipedia ↗
        </a>
      </div>
    </div>
  );
}
