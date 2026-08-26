import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 사내망 + Cloudflare Quick Tunnel 테스트 접근 허용 (다른 PC/외부에서 dev 서버의 정적 리소스를 요청할 수 있도록).
  // LAN IP는 Wi-Fi 재연결마다 바뀔 수 있어서 최근 관측된 값들을 같이 남겨둔다.
  allowedDevOrigins: ["192.168.0.47", "192.168.0.201", "*.trycloudflare.com"],
  // 로컬 개발 전용: 프론트 서버가 /api/*를 로컬 백엔드(:8000)로 대신 전달해준다 — LAN IP든
  // Cloudflare 터널 주소든 프론트 하나만 열어도 API까지 같이 동작하게 하기 위함.
  // Vercel 등 실제 배포 환경에는 로컬호스트가 없으므로(요청이 DNS_HOSTNAME_RESOLVED_PRIVATE로
  // 막힘), 배포 환경에서는 이 rewrite를 아예 걸지 않는다 — 대신 NEXT_PUBLIC_API_BASE 환경변수로
  // 백엔드 주소를 직접 가리키게 한다 (src/lib/api.ts 참고).
  async rewrites() {
    if (process.env.VERCEL || process.env.NEXT_PUBLIC_API_BASE) return [];
    return [{ source: "/api/:path*", destination: "http://localhost:8000/api/:path*" }];
  },
};

export default nextConfig;
