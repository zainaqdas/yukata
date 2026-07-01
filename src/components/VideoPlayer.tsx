"use client";

import { useEffect, useRef } from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";

interface VideoPlayerProps {
  /** HLS manifest URL (.m3u8) — played via hls.js */
  hlsUrl?: string;
  /** Direct video URL (.mp4, .webm) — played natively */
  directUrl?: string;
  poster?: string;
  className?: string;
}

export function VideoPlayer({ hlsUrl, directUrl, poster, className = "" }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);

  // Determine the video source
  const videoUrl = hlsUrl || directUrl || "";
  const isHls = !!hlsUrl;

  useEffect(() => {
    if (!videoRef.current || !videoUrl) return;

    const player = videojs(videoRef.current, {
      controls: true,
      responsive: true,
      fluid: true,
      poster,
      playbackRates: [0.5, 1, 1.25, 1.5, 2],
      html5: {
        hls: {
          overrideNative: !isHls ? false : true,
        },
      },
    });

    playerRef.current = player;

    player.ready(() => {
      if (isHls) {
        player.src({
          src: videoUrl,
          type: "application/x-mpegURL",
        });
      } else {
        player.src({
          src: videoUrl,
          type: "video/mp4",
        });
      }
    });

    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
      }
    };
  }, [videoUrl, isHls, poster]);

  if (!videoUrl) {
    return (
      <div className={`flex items-center justify-center bg-zinc-900 rounded-xl border border-zinc-800 ${className}`}>
        <div className="text-center p-12">
          <svg className="w-12 h-12 text-zinc-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p className="text-zinc-400 font-medium">Video stream unavailable</p>
          <p className="text-zinc-600 text-sm mt-1">The stream link may have expired. Please contact support.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl overflow-hidden bg-black ${className}`}>
      <video
        ref={videoRef}
        className="video-js vjs-big-play-centered vjs-theme-city"
        playsInline
      />
    </div>
  );
}
