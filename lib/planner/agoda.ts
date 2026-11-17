import type { Hotel, TripRequest } from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any -- the RapidAPI Agoda response is untyped */

/*
 * Agoda pricing (checked against live responses):
 *  - price.perRoomPerNight.inclusive.display = one room, one night, taxes included.
 *  - price.perBook.inclusive.display         = Agoda's total for the stay as offered
 *                                              (= nights × perRoomPerNight × rooms in the offer).
 *  - room.occupancy                          = guests Agoda placed in each room of this offer
 *                                              (not the room's capacity: a "Triple" can show 2).
 *  - enrichment.roomInformation.cheapestRoomName = the room type that price is for.
 * Agoda may offer one larger room (e.g. a triple) even when more rooms were requested, so the
 * stay total comes from perBook, adding rooms only if the offer can't fit every traveller.
 */

const SHOWN = 6;

function parseHotel(hotel: any, req: TripRequest): Hotel | null {
  const info = hotel.content?.informationSummary || {};
  const geo = info.geoInfo || {};
  const room = hotel.pricing?.offers?.[0]?.roomOffers?.[0]?.room;
  const p = room?.pricing?.[0]?.price;
  const perRoomNight = Number(p?.perRoomPerNight?.inclusive?.display || p?.perNight?.inclusive?.display || 0);
  if (!info.defaultName || perRoomNight <= 0) return null;

  const perBook = Number(p?.perBook?.inclusive?.display || 0);
  const occupancy = Number(room?.occupancy) || 0;
  const offerRooms = perBook > 0 ? Math.max(1, Math.round(perBook / (perRoomNight * req.nights))) : req.rooms;
  const roomsNeeded = occupancy > 0 ? Math.max(offerRooms, Math.ceil(req.travellers / occupancy)) : Math.max(offerRooms, req.rooms);
  const stayTotal = Math.round(perRoomNight * req.nights * roomsNeeded);

  let image: string = hotel.content?.images?.hotelImages?.[0]?.urls?.[0]?.value || "";
  if (image.startsWith("//")) image = `https:${image}`;
  const id = String(hotel.propertyId ?? info.defaultName);

  const link = new URLSearchParams({
    selectedproperty: id,
    checkIn: req.checkinDate,
    los: String(req.nights),
    rooms: String(roomsNeeded),
    adults: String(req.travellers),
    currency: "BDT",
  });

  return {
    id,
    name: info.defaultName,
    starRating: Math.round(Number(info.rating) || 0),
    location: info.address?.city?.name || "Unknown",
    fullAddress: [info.address?.area?.name, info.address?.city?.name].filter(Boolean).join(", "),
    price: perRoomNight,
    roomName: hotel.enrichment?.roomInformation?.cheapestRoomName || undefined,
    occupancy: occupancy || undefined,
    rooms: roomsNeeded,
    stayTotal,
    overBudgetBy: req.hotel_budget !== null ? Math.max(0, stayTotal - req.hotel_budget) : 0,
    image,
    latitude: geo.latitude,
    longitude: geo.longitude,
    amenities: (hotel.content?.features?.hotelFacilities || []).map((f: any) => f.name).filter(Boolean).slice(0, 4),
    isAvailable: hotel.pricing?.isAvailable === true,
    bookingUrl: hotel.propertyId ? `https://www.agoda.com/search?${link}` : undefined,
  };
}

/**
 * Live hotel search, without a price cap (a cap can leave just one result). Hotels that fit the
 * hotel budget come first, cheapest first; over-budget ones follow, tagged with how much over.
 */
export async function searchHotels(req: TripRequest, signal: AbortSignal): Promise<Hotel[]> {
  const params = new URLSearchParams({
    query: req.destination!,
    checkinDate: req.checkinDate,
    checkoutDate: req.checkoutDate,
    room: String(req.rooms),
    adult: String(req.travellers),
    pageSize: "30",
    languageCode: "en-us",
    currencyCode: "BDT",
  });

  const res = await fetch(`https://agoda-travel.p.rapidapi.com/agoda-app/hotels/search-overnight?${params}`, {
    headers: {
      "x-rapidapi-key": process.env.RAPIDAPI_KEY ?? "",
      "x-rapidapi-host": "agoda-travel.p.rapidapi.com",
    },
    signal,
  });
  if (!res.ok) throw new Error(`Agoda search failed (${res.status})`);
  const data = await res.json();
  const hotels = ((data.data?.properties || []) as any[])
    .map((h) => parseHotel(h, req))
    .filter((h): h is Hotel => h !== null);

  if (req.hotel_budget !== null) {
    hotels.sort((a, b) => Number(a.overBudgetBy > 0) - Number(b.overBudgetBy > 0) || a.stayTotal - b.stayTotal);
  }
  return hotels.slice(0, SHOWN);
}
