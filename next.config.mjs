/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",
    basePath: process.env.URL_BASE_PATH === undefined ? "/__NEXT_BASE_PATH_PLACEHOLDER__" : process.env.URL_BASE_PATH,
};

export default nextConfig;
