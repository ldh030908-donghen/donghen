import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 사내망 + Cloudflare Quick Tunnel 테스트 접근 허용 (다른 PC/외부에서 dev 서버의 정적 리소스를 요청할 수 있도록).
  allowedDevOrigins: ["192.168.0.201", "*.trycloudflare.com"],
  // 프론트 서버가 /api/* 요청을 백엔드(:8000)로 대신 전달해준다 — 브라우저 입장에서는 항상
  // "지금 접속한 주소"(LAN IP든 Cloudflare 터널 주소든) 하나로만 통신하면 되므로, 터널을
  // 프론트(3000) 하나만 열어도 API까지 같이 동작한다. (별도 8000 포트 터널/CORS 설정 불필요)
  async rewrites() {
    return [{ source: "/api/:path*", destination: "http://localhost:8000/api/:path*" }];
  },
};

export default nextConfig;
