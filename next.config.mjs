/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",
    basePath: process.env.URL_BASE_PATH || "",
};

export default nextConfig;
