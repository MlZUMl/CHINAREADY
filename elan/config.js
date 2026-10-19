// Configuration d'Élan, lue au démarrage. Ce fichier ne contient que des valeurs publiques :
// la clé « publishable » de Supabase est faite pour être dans le navigateur (la sécurité
// repose sur les règles RLS de la base), et la clé publique des rappels push aussi.
window.ELAN_CONFIG = {
  supabaseUrl: 'https://rfuotoxmitsuxmdvovso.supabase.co',
  supabaseKey: 'sb_publishable_efeKcb8taKVN-XDl519avg_2-yM1If4',
  vapidPublicKey: 'BMSId3QTq4DAurhdxi3PghvMk9pQMLDE0KkrBwe9U7xNl2mY4yfL0Xikl-2j1zCGuqf2zoREz6yQtXYD_txHfrU',
  // Pour remplacer une illustration par ta propre image (ComfyUI, dessin…), dépose-la dans
  // le dossier « art » puis ajoute une ligne, par exemple :
  //   'compagnon-chat': 'art/chat.png',      (compagnon : chat, lapin, nuage, creature, pousse)
  //   'avatar': 'art/avatar.png',            (personnage, format portrait 3:4)
  //   'zone-chambre': 'art/chambre.png',     (fond de zone : chambre, jardin, bibliotheque, atelier, balcon)
  //   'objet-pothos': 'art/pothos.png',      (objet de l'univers, carré)
  art: {},
}
