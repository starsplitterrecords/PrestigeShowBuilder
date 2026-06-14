import { GoogleGenAI } from "@google/genai";
import { Show } from "../../types/models";
import { withRetry, compressAndStore } from "../geminiClient";
import { COMPRESS_QUALITY_PAGE } from "../../constants/generation.constants";
import { GenerationMode } from "../../utils/generationMode";

/**
 * Image-to-image refinement. Sends the source page and a correction
 * instruction to Gemini. Returns a new assetId for the corrected image.
 * Inherits imageSize from the source -- no size change.
 */
export const refineComicPage = async (
  sourceDataUri: string,
  instruction: string,
  show: Show,
  sourceImageSize: string,
  mode: GenerationMode
): Promise<string | null> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const toBase64 = (uri: string) =>
      uri.replace(/^data:image\/\w+;base64,/, "");

    const comic = show.comicStyle;
    const styleNote = comic?.artistStyle
      ? "MAINTAIN THIS ART STYLE EXACTLY: " + comic.artistStyle + "."
      : "Maintain the existing art style exactly.";

    const correctionPrompt = [
      "[COMIC PAGE TO CORRECT]",
      "Make ONLY the following correction to this comic page.",
      "Preserve the panel layout, all characters, the art style,",
      "and everything not explicitly described below.",
      "",
      "CORRECTION: " + instruction,
      "",
      styleNote,
      "NO COMPOSITION CHANGES.",
      "NO ART STYLE CHANGES.",
      "NO PANEL LAYOUT CHANGES.",
    ].join("\n");

    const parts: any[] = [
      { text: correctionPrompt },
      { inlineData: {
          mimeType: "image/png",
          data: toBase64(sourceDataUri)
      } },
    ];

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: { parts },
      config: { imageConfig: {
        aspectRatio: "3:4",
        imageSize: sourceImageSize as any,
      } },
    });

    const imagePart = response.candidates?.[0]?.content?.parts
      ?.find((p: any) => p.inlineData);
    if (!imagePart) return null;

    const dataUri = "data:image/png;base64," + imagePart.inlineData!.data;
    return compressAndStore(dataUri, COMPRESS_QUALITY_PAGE);
  });
};
