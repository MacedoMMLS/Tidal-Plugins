import { type ExtendedPlayackInfo, ManifestMimeType } from "@inrixia/lib/Caches/PlaybackInfoTypes";
import { availableTags, MetaTags } from "@inrixia/lib/makeTags";
import { settings } from "./Settings";
import type { PathInfo } from "@inrixia/lib/native/downloadTrack.native";

const unsafeCharacters = /[\/:*?"<>|]/g;
const sanitizeFilename = (filename: string): string => filename.replace(unsafeCharacters, "");

const formatTrackNumber = (trackNumber: string | undefined): string | undefined => {
	if (!trackNumber) return undefined;
	const num = parseInt(trackNumber, 10);
	return isNaN(num) ? trackNumber : num.toString().padStart(2, "0");
};

export const parseExtension = (filename: string) =>
	filename.match(/\.([0-9a-z]+)(?:[\?#]|$)/i)?.[1] ?? undefined;

const filePathFromInfo = ({ tags }: MetaTags, { manifest, manifestMimeType }: ExtendedPlayackInfo): string => {
	let base = settings.filenameFormat;

	for (const tag of availableTags) {
		let tagValue = tags[tag];

		if (Array.isArray(tagValue)) tagValue = tagValue[0];

		// Skip if tagValue is undefined
		if (tagValue === undefined) continue;

		// Format track number to double digits
		if (tag === "trackNumber") {
			tagValue = formatTrackNumber(tagValue) || tagValue;
		}

		// Replace the placeholder with the sanitized value
		base = base.replaceAll(`{${tag}}`, sanitizeFilename(tagValue));
	}

	switch (manifestMimeType) {
		case ManifestMimeType.Tidal: {
			if (manifest.codecs === "mqa") {
				return `${base}.mqa.flac`;
			}
			return `${base}.${manifest.codecs}`;
		}
		case ManifestMimeType.Dash: {
			const trackManifest = manifest.tracks.audios[0];
			return `${base}.${trackManifest.codec.toLowerCase()}.m4a`;
		}
	}
};

export const pathSeparator = navigator.userAgent.includes("Win") ? "\\" : "/";

export const parseFileName = (metaTags: MetaTags, extPlaybackInfo: ExtendedPlayackInfo): PathInfo => {
	let filePath = filePathFromInfo(metaTags, extPlaybackInfo);
	filePath = pathSeparator === "\\" ? filePath.replaceAll("/", pathSeparator) : filePath;
	let pathParts = filePath.split(pathSeparator);
	const fileName = pathParts.pop();
	return {
		fileName,
		folderPath: pathParts.join(pathSeparator),
	};
};
