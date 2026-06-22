import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#3f4f6e",
        }}
      >
        <svg width="390" height="390" viewBox="0 0 390 390" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="58" y="58" width="274" height="274" rx="76" stroke="#ffa665" strokeWidth="34" />
          <path
            d="M126 126H262C279.673 126 294 140.327 294 158V194C294 211.673 279.673 226 262 226H202C184.327 226 170 240.327 170 258V294H126"
            stroke="#ffa665"
            strokeWidth="34"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}