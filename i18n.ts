
import { notFound } from 'next/navigation';
import { getRequestConfig } from 'next-intl/server';

const locales = ['en', 'ar'];

export default getRequestConfig(async ({ requestLocale }) => {
  // next-intl v4's GetRequestConfigParams.locale is only populated for
  // explicit per-call overrides (e.g. getTranslations({ locale: 'en' })) —
  // the [locale] segment value that the middleware actually matched comes
  // through requestLocale, and it's a Promise. Destructuring `locale`
  // directly (the v3 API) left it always undefined here, so every request
  // failed this check and 404'd regardless of a valid /en or /ar path.
  const locale = await requestLocale;

  if (!locale || !locales.includes(locale)) notFound();

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default
  };
});
