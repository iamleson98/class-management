export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/home', '/about', '/courses', '/news', '/contact', '/register', '/login', '/forgot-password', '/reset-password', '/logout', '/uploads'],
        disallow: ['/api/', '/'],
      },
    ],
  }
}
