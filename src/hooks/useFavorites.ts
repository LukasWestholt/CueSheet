import { useState } from 'react';
import { loadFavorites, saveFavorites } from '../data/favorites';

/** Starred routine ids, persisted to localStorage. */
export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(loadFavorites);

  const toggleFavorite = (id: string) =>
    setFavorites((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveFavorites(next);
      return next;
    });

  return { favorites, toggleFavorite };
}
