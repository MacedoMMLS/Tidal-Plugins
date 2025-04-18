import { fetchIsrcIterable, TApiTrack } from "./api/tidal";
import { AsyncCachable } from "./Caches/AsyncCachable";
import { ExtendedMediaItem } from "./Caches/ExtendedTrackItem";
import { MediaItemCache } from "./Caches/MediaItemCache";
import { ItemId, MediaItem, TrackItem } from "neptune-types/tidal";

export type TrackFilter = (trackItem: TApiTrack) => boolean;
export class MaxTrack {
	public static getMaxTrack = AsyncCachable(async (itemId: ItemId): Promise<TrackItem | false> => {
		const extTrackItem = await ExtendedMediaItem.getTrack(itemId);
		if (extTrackItem === undefined) return false;
		if (extTrackItem.tidalTrack.contentType === "track" && this.hasHiRes(extTrackItem.tidalTrack)) return false;

		for await (const trackItem of this.getTracksFromMediaItem(extTrackItem, this.hasHiResApi)) {
			return trackItem;
		}
		return false;
	});
	public static getLatestMaxTrack = AsyncCachable(async (itemId: ItemId): Promise<TrackItem | false> => {
		const extTrackItem = await ExtendedMediaItem.getTrack(itemId);
		if (extTrackItem === undefined) return false;

		let currentTrackItem: TrackItem | false = false;
		for await (const trackItem of this.getTracksFromMediaItem(extTrackItem)) {
			if (currentTrackItem === undefined) {
				currentTrackItem = trackItem;
				continue;
			}
			const isLowerQuality = !this.hasHiRes(trackItem) && this.hasHiRes(<TrackItem>currentTrackItem);
			const isHigherQuality = this.hasHiRes(trackItem) && !this.hasHiRes(<TrackItem>currentTrackItem);
			if (isLowerQuality) continue;
			if (isHigherQuality) {
				currentTrackItem = trackItem;
				continue;
			}
			const isNewer = new Date(trackItem.streamStartDate!) > new Date((<TrackItem>currentTrackItem).streamStartDate!);
			if (isNewer) {
				currentTrackItem = trackItem;
				continue;
			}
		}
		return currentTrackItem;
	});
	public static async *getTracksFromMediaItem(extMediaItem: ExtendedMediaItem, filter?: TrackFilter): AsyncGenerator<TrackItem> {
		const { tidalTrack } = extMediaItem;

		const isrcs = await extMediaItem.isrcs();
		if (isrcs.size === 0) return;

		for (const isrc of isrcs) {
			for await (const trackItem of this.getTracksFromISRC(isrc, filter)) {
				if (trackItem.id === tidalTrack.id) continue;
				yield trackItem;
			}
		}
	}
	public static async *getTracksFromISRC(isrc: string, filter?: TrackFilter): AsyncGenerator<TrackItem> {
		for await (const track of fetchIsrcIterable(isrc)) {
			if (track.id === undefined) continue;
			if (track.type !== "tracks") continue;
			if (filter && !filter(track)) continue;
			const trackItem = await MediaItemCache.ensureTrack(track.id);
			if (trackItem?.id !== undefined) yield trackItem;
		}
	}
	public static hasHiRes(trackItem: TrackItem): boolean {
		const tags = trackItem.mediaMetadata?.tags;
		if (tags === undefined) return false;
		return tags.includes("HIRES_LOSSLESS");
	}
	public static hasHiResApi(apiTrack: TApiTrack): boolean {
		const tags = apiTrack.attributes.mediaTags;
		if (tags === undefined) return false;

		return tags.includes("HIRES_LOSSLESS");
	}
}
