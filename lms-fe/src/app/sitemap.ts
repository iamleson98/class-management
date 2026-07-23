import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.APP_URL || 'http://localhost:3000'
  return [
    { url: baseUrl + '/home', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: baseUrl + '/about', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: baseUrl + '/courses', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: baseUrl + '/news', lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: baseUrl + '/contact', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: baseUrl + '/register', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: baseUrl + '/login', lastModified: new Date(), changeFrequency: 'yearly', priority: 0.5 },
  ]
}
