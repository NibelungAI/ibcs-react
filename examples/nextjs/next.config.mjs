/** @type {import('next').NextConfig} */
const nextConfig = {
  // ibcs-react ships ESM + TS-friendly output; transpiling it here keeps the
  // example robust across linked/local checkouts and published builds alike.
  transpilePackages: ["ibcs-react"],
};

export default nextConfig;
