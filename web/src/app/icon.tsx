import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
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
          background: "#0a0c0f",
          borderRadius: 14
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            background: "#34caa4",
            boxShadow: "0 0 22px 6px rgba(52,202,164,0.75)"
          }}
        />
      </div>
    ),
    { ...size }
  );
}
