import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 사내망 + Cloudflare Quick Tunnel 테스트 접근 허용 (다른 PC/외부에서 dev 서버의 정적 리소스를 요청할 수 있도록).
  allowedDevOrigins: ["10.10.7.11", "*.trycloudflare.com"],
};

export default nextConfig;
