import { formatDistanceToNow, parseISO, format } from "date-fns";

const FORMAT_LONG = "EEEE, MMMM d, yyyy h:mm a zz";
const FORMAT_SHORT = "MMMM dd, yyyy zz";

const dateCache = new Map<string, Date>();

// FONCTION CORRIGÉE - Vérification de la date avant parseISO
export const getDateDistance = (date: string | undefined | null) => {
  // Vérifier que la date existe et n'est pas vide
  if (!date || date === '' || date === null || date === undefined) {
    return 'Date non disponible';
  }

  try {
    return formatDistanceToNow(parseISO(date), {
      addSuffix: true,
    });
  } catch (error) {
    console.error('Erreur formatage date:', error);
    return 'Date invalide';
  }
};

export const normalizeDate = (date: string | Date): string =>
  date instanceof Date ? date.toISOString() : date;

const getParsedDate = (dateString: string): Date => {
  // Vérifier que dateString n'est pas vide
  if (!dateString || dateString.trim() === '') {
    throw new Error("Date string is empty or undefined.");
  }

  if (dateCache.has(dateString)) {
    return dateCache.get(dateString)!;
  }

  const parsedDate = parseISO(dateString);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error("Invalid date value provided.");
  }

  dateCache.set(dateString, parsedDate);
  return parsedDate;
};

export const formatDate = (
  date: string | Date | undefined | null,
  formatType: "long" | "short" = "long"
) => {
  // Vérifier que la date existe
  if (!date) {
    return 'Date non disponible';
  }

  try {
    // Ensure that the date is a valid Date string
    const dateString = date instanceof Date ? date.toISOString() : date;

    // Get parsed date from cache or parse it
    const parsedDate = getParsedDate(dateString);

    // Format the date based on the requested format
    return format(parsedDate, formatType === "short" ? FORMAT_SHORT : FORMAT_LONG);
  } catch (error) {
    console.error('Erreur formatage date:', error);
    return 'Date invalide';
  }
};