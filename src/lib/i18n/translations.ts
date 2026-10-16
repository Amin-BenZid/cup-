export type Locale = "fr" | "ar" | "en";

export const LOCALES: {
  id: Locale;
  label: string;
  native: string;
  dir: "ltr" | "rtl";
}[] = [
  { id: "fr", label: "French", native: "Français", dir: "ltr" },
  { id: "ar", label: "Arabic", native: "العربية", dir: "rtl" },
  { id: "en", label: "English", native: "English", dir: "ltr" },
];

export const DEFAULT_LOCALE: Locale = "fr";

export type TranslationKey = keyof typeof translations.fr;

export const translations = {
  fr: {
    "noOrder.title": "Aucune commande active",
    "noOrder.body":
      "Vous n'avez pas de commande en cours. Scannez le QR code au comptoir pour commencer.",
    "noOrder.scanPrompt": "Scannez le QR au comptoir",
    "noOrder.scanHint": "Il apparaît sur la tablette du barista",
    // Landing
    "landing.tagline": "Votre café, prêt quand vous l'êtes.",
    "landing.subtitle":
      "Transformez n'importe quel téléphone en bipeur de café. Aucun matériel à acheter, aucun bipeur à perdre.",
    "landing.setup": "Créer un café",
    "landing.setupHint": "Ouvrez votre boutique en 30 secondes",
    "landing.barista": "Connexion barista",
    "landing.baristaHint": "Connectez-vous avec le code de la boutique",
    "landing.howItWorks": "Comment ça marche",
    "landing.step1": "Le barista encaisse la commande",
    "landing.step1Hint": "Un QR code apparaît sur la tablette",
    "landing.step2": "Le client le scanne",
    "landing.step2Hint": "Son téléphone devient le bipeur, sans rien installer",
    "landing.step3": "Le téléphone sonne quand c'est prêt",
    "landing.step3Hint": "Fort, distinct, impossible à manquer",
    "landing.footer": "Conçu pour les cafés qui préfèrent faire du café",

    // Setup
    "setup.back": "Retour",
    "setup.title": "Créez votre café",
    "setup.subtitle":
      "Deux champs et c'est parti. Vous pourrez tout personnaliser plus tard.",
    "setup.shopName": "Nom du café",
    "setup.shopNameHint": "Ce que verront vos clients",
    "setup.shopNamePlaceholder": "Café Nomad",
    "setup.pin": "Code barista",
    "setup.pinHint":
      "4 à 6 chiffres. Les baristas l'utilisent pour se connecter.",
    "setup.create": "Créer le café",
    "setup.creating": "Création…",
    "setup.haveAccount": "Vous avez déjà un café ?",
    "setup.loginLink": "Connectez-vous",
    "setup.error.nameRequired": "Le nom du café est requis.",
    "setup.error.pinTooShort": "Le code doit comporter au moins 4 chiffres.",

    // Barista login
    "login.title": "Connexion barista",
    "login.subtitle":
      "Entrez le code de votre café pour ouvrir le tableau de bord.",
    "login.button": "Se connecter",
    "login.error.pinTooShort": "Le code doit comporter au moins 4 chiffres.",
    "login.newShop": "Nouveau café ?",
    "login.setupLink": "Créez-en un",
    "login.footer": "Gardez cet onglet ouvert pendant votre service",
    "login.error.disabled": "Ce café a été désactivé. Contactez le support.",

    // Dashboard
    "dash.role": "Cup · Barista",
    "dash.customize": "Personnaliser",
    "dash.logout": "Déconnexion",
    "dash.newOrder": "Nouvelle commande",
    "dash.activeOrders": "Commandes en cours",
    "dash.noOrders": "Aucune commande en cours",
    "dash.noOrdersHint": "Appuyez sur « Nouvelle commande » pour commencer",
    "dash.ready": "Prêt",
    "dash.preparing": "En préparation",
    "dash.markReady": "Prêt",
    "dash.saving": "Enregistrement…",
    "dash.pickedUp": "Récupéré",
    "dash.customerConnected": "Client connecté",
    "dash.notScanned": "Non scanné",
    "dash.ago.s": "il y a %d s",
    "dash.ago.m": "il y a %d min",
    "dash.ago.h": "il y a %d h",

    // New order modal
    "order.title": "Nouvelle commande",
    "order.subtitle": "Entrez le numéro de la commande",
    "order.placeholder": "42",
    "order.create": "Créer et afficher le QR",
    "order.creating": "Création…",
    "order.error.required": "Entrez un numéro de commande",

    // QR modal
    "qr.title": "Commande",
    "qr.subtitle": "Le client scanne ceci pour être notifié",
    "qr.close": "Fermer",

    // Customer page
    "cust.yourOrder": "Votre commande",
    "cust.preparing": "On s'en occupe",
    "cust.willRing":
      "Nous ferons sonner cette page quand votre commande sera prête",
    "cust.ready": "Votre commande est prête",
    "cust.pickup": "À récupérer au comptoir",
    "cust.gotIt": "Compris",
    "cust.enjoy": "Bon café",
    "cust.canClose": "Vous pouvez fermer cette page.",
    "cust.received": "Reçue",
    "cust.preparingStep": "En préparation",
    "cust.readyStep": "Prête",
    "cust.whileYouWait": "En attendant",
    "cust.keepOpen":
      "Gardez cette page ouverte. Elle se met à jour automatiquement.",
    "cust.poweredBy": "Propulsé par Cup",

    // Notifications
    "notif.title": "Soyez notifié quand c'est prêt",
    "notif.body":
      "Autorisez les notifications et nous vous préviendrons, même si la page est fermée.",
    "notif.enable": "Activer les notifications",
    "notif.enabling": "Activation…",
    "notif.notNow": "Plus tard",

    // Common
    "common.loading": "Chargement…",
    "common.justAMoment": "Un instant",
    "common.orderNotFound": "Commande introuvable",
    "common.askBarista": "Demandez au barista.",
    "common.back": "Retour",

    // Pending
    "pending.title": "En attente d'approbation",
    "pending.body":
      "Merci, {name} ! Votre demande a bien été reçue. Un administrateur va l'examiner sous peu.",
    "pending.whatHappens": "Ce qui se passe ensuite",
    "pending.step1": "Un administrateur examine votre demande",
    "pending.step2": "Vous recevez l'approbation — généralement sous 24h",
    "pending.step3": "Vous accédez à votre tableau de bord barista",
    "pending.autoRefresh":
      "Cette page se met à jour automatiquement. Vous pouvez la laisser ouverte.",
    "pending.approved": "Approuvé !",
    "pending.redirecting": "Redirection vers votre tableau de bord…",
    "pending.declined": "Demande refusée",
    "pending.declinedBody":
      "Malheureusement, cette demande n'a pas été approuvée. Contactez-nous si vous pensez qu'il s'agit d'une erreur.",
    "pending.backHome": "Retour à l'accueil",
    "pending.unknown": "Impossible de vérifier le statut. Rechargez la page.",

    // Customize
    "cz.title": "Personnaliser",
    "cz.saving": "Enregistrement",
    "cz.saved": "Enregistré",
    "cz.preview": "Aperçu",
    "cz.livePreview": "Aperçu en direct",
    "cz.phone": "Téléphone",
    "cz.desktop": "Bureau",
    "cz.preparingState": "Préparation",
    "cz.readyState": "Prêt",
    "cz.tab.branding": "Marque",
    "cz.tab.theme": "Thème",
    "cz.tab.game": "Jeu",
    "cz.tab.messages": "Messages",
    "cz.branding.shopName": "Nom du café",
    "cz.branding.shopNameHint": "Le nom que voient vos clients",
    "cz.branding.tagline": "Slogan",
    "cz.branding.taglineHint": "Une courte ligne sous votre nom",
    "cz.branding.taglinePlaceholder": "Petit lot, matins lents",
    "cz.branding.logo": "Logo",
    "cz.branding.logoHint": "Téléchargez, puis ajustez la position et le zoom",
    "cz.branding.removeLogo": "Supprimer le logo",
    "cz.branding.adjust": "Ajuster",
    "cz.branding.dragPreview": "Glissez l'aperçu pour repositionner",
    "cz.branding.reset": "Réinitialiser",
    "cz.theme.palette": "Palette",
    "cz.theme.paletteHint": "Définit l'arrière-plan, le texte et les accents",
    "cz.theme.primaryColor": "Couleur principale",
    "cz.theme.primaryColorHint": "Utilisée pour les boutons et en-têtes",
    "cz.theme.font": "Police",
    "cz.theme.fontHint": "S applique aux titres et au texte",
    "cz.theme.reset": "Réinitialiser aux valeurs par défaut",
    "cz.game.waitingGame": "Jeu d'attente",
    "cz.game.waitingGameHint": "Affiché au client pendant qu'il attend",
    "cz.game.catchBeans": "Attrapez les grains",
    "cz.game.catchBeansHint": "Glissez la tasse, attrapez ce qui tombe",
    "cz.game.none": "Aucun jeu",
    "cz.game.noneHint": "Afficher seulement le statut de la commande",
    "cz.messages.preparing": "En préparation",
    "cz.messages.preparingHint": "Affiché pendant l'attente du client",
    "cz.messages.ready": "Prêt",
    "cz.messages.readyHint": "Affiché quand la commande est prête",
    "cz.messages.preview": "Aperçu",
    "cz.messages.orderLabel": "Commande #42",

    // Customize — LogoUploader
    "cz.logo.upload": "Télécharger",
    "cz.logo.replace": "Remplacer",
    "cz.logo.adjustTitle": "Ajustez votre logo",
    "cz.logo.adjustHint":
      "Glissez pour déplacer · pincez ou faites défiler pour zoomer",
    "cz.logo.cancel": "Annuler",
    "cz.logo.useImage": "Utiliser l'image",
    "cz.logo.uploading": "Envoi…",
    "cz.logo.error.format": "PNG, JPG, WEBP ou SVG uniquement",
    "cz.logo.error.size": "Max 5 Mo",
    "cz.logo.error.process": "Échec du traitement de l'image",
    "cz.logo.error.upload": "Échec du téléchargement",
  },

  ar: {
    "noOrder.title": "لا يوجد طلب نشط",
    "noOrder.body": "ليس لديك طلب حالي. امسح رمز QR على الكاونتر للبدء.",
    "noOrder.scanPrompt": "امسح رمز QR على الكاونتر",
    "noOrder.scanHint": "يظهر على جهاز الباريستا",
    // Landing
    "landing.tagline": "قهوتك جاهزة عندما تكون أنت جاهزاً.",
    "landing.subtitle":
      "حوّل أي هاتف إلى جهاز تنبيه للمقهى. لا أجهزة تشتريها، ولا أجهزة تفقدها.",
    "landing.setup": "أنشئ مقهى",
    "landing.setupHint": "افتح متجرك في 30 ثانية",
    "landing.barista": "دخول الباريستا",
    "landing.baristaHint": "سجّل الدخول برمز المقهى",
    "landing.howItWorks": "كيف يعمل",
    "landing.step1": "الباريستا يسجّل الطلب",
    "landing.step1Hint": "يظهر رمز QR على الجهاز اللوحي",
    "landing.step2": "العميل يمسحه",
    "landing.step2Hint": "هاتفه يصبح جهاز التنبيه، بدون أي تطبيق",
    "landing.step3": "الهاتف يرن عندما يصبح جاهزاً",
    "landing.step3Hint": "بصوت عالٍ وواضح لا يمكن تفويته",
    "landing.footer": "صُمم للمقاهي التي تفضّل صناعة القهوة",

    // Setup
    "setup.back": "رجوع",
    "setup.title": "أنشئ مقهىك",
    "setup.subtitle": "حقلان وتبدأ. يمكنك تخصيص كل شيء لاحقاً.",
    "setup.shopName": "اسم المقهى",
    "setup.shopNameHint": "ما يراه عملاؤك",
    "setup.shopNamePlaceholder": "مقهى نوماد",
    "setup.pin": "رمز الباريستا",
    "setup.pinHint": "من 4 إلى 6 أرقام. يستخدمه الباريستا لتسجيل الدخول.",
    "setup.create": "إنشاء المقهى",
    "setup.creating": "جارٍ الإنشاء…",
    "setup.haveAccount": "لديك مقهى بالفعل؟",
    "setup.loginLink": "سجّل الدخول",
    "setup.error.nameRequired": "اسم المقهى مطلوب.",
    "setup.error.pinTooShort": "يجب أن يكون الرمز 4 أرقام على الأقل.",

    // Barista login
    "login.title": "دخول الباريستا",
    "login.subtitle": "أدخل رمز مقهىك لفتح لوحة التحكم.",
    "login.button": "تسجيل الدخول",
    "login.error.pinTooShort": "يجب أن يكون الرمز 4 أرقام على الأقل.",
    "login.newShop": "مقهى جديد؟",
    "login.setupLink": "أنشئ واحداً",
    "login.footer": "أبقِ هذه الصفحة مفتوحة خلال نوبتك",
    "login.error.disabled": "تم تعطيل هذا المقهى. تواصل مع الدعم.",

    // Dashboard
    "dash.role": "Cup · باريستا",
    "dash.customize": "تخصيص",
    "dash.logout": "خروج",
    "dash.newOrder": "طلب جديد",
    "dash.activeOrders": "الطلبات النشطة",
    "dash.noOrders": "لا توجد طلبات نشطة",
    "dash.noOrdersHint": "اضغط على «طلب جديد» للبدء",
    "dash.ready": "جاهز",
    "dash.preparing": "قيد التحضير",
    "dash.markReady": "جاهز",
    "dash.saving": "جارٍ الحفظ…",
    "dash.pickedUp": "تم الاستلام",
    "dash.customerConnected": "العميل متصل",
    "dash.notScanned": "لم يمسح",
    "dash.ago.s": "قبل %d ث",
    "dash.ago.m": "قبل %d د",
    "dash.ago.h": "قبل %d س",

    // New order modal
    "order.title": "طلب جديد",
    "order.subtitle": "أدخل رقم الطلب",
    "order.placeholder": "42",
    "order.create": "إنشاء وعرض QR",
    "order.creating": "جارٍ الإنشاء…",
    "order.error.required": "أدخل رقم الطلب",

    // QR modal
    "qr.title": "الطلب",
    "qr.subtitle": "يمسح العميل هذا للتنبيه",
    "qr.close": "إغلاق",

    // Customer page
    "cust.yourOrder": "طلبك",
    "cust.preparing": "نعمل عليه",
    "cust.willRing": "سنرن هذه الصفحة عندما يصبح طلبك جاهزاً",
    "cust.ready": "طلبك جاهز",
    "cust.pickup": "استلمه من الكاونتر",
    "cust.gotIt": "فهمت",
    "cust.enjoy": "استمتع بقهوتك",
    "cust.canClose": "يمكنك إغلاق هذه الصفحة الآن.",
    "cust.received": "تم الاستلام",
    "cust.preparingStep": "قيد التحضير",
    "cust.readyStep": "جاهز",
    "cust.whileYouWait": "في أثناء الانتظار",
    "cust.keepOpen": "أبقِ هذه الصفحة مفتوحة. يتم تحديثها تلقائياً.",
    "cust.poweredBy": "بدعم من Cup",

    // Notifications
    "notif.title": "أشعرني عندما يصبح جاهزاً",
    "notif.body": "اسمح بالإشعارات وسنخبرك، حتى لو كانت الصفحة مغلقة.",
    "notif.enable": "تفعيل الإشعارات",
    "notif.enabling": "جارٍ التفعيل…",
    "notif.notNow": "ليس الآن",

    // Common
    "common.loading": "جارٍ التحميل…",
    "common.justAMoment": "لحظة من فضلك",
    "common.orderNotFound": "الطلب غير موجود",
    "common.askBarista": "اسأل الباريستا.",
    "common.back": "رجوع",

    // Pending
    "pending.title": "بانتظار الموافقة",
    "pending.body":
      "شكراً يا {name}! تم استلام طلبك. سيراجعه أحد المشرفين قريباً.",
    "pending.whatHappens": "ما الذي يحدث بعد ذلك",
    "pending.step1": "يراجع المشرف طلبك",
    "pending.step2": "تتلقى الموافقة — عادةً خلال 24 ساعة",
    "pending.step3": "تفتح لوحة تحكم الباريستا الخاصة بك",
    "pending.autoRefresh":
      "يتم تحديث هذه الصفحة تلقائياً. يمكنك إبقاؤها مفتوحة.",
    "pending.approved": "تمت الموافقة!",
    "pending.redirecting": "جارٍ التحويل إلى لوحة التحكم…",
    "pending.declined": "تم رفض الطلب",
    "pending.declinedBody":
      "للأسف لم تتم الموافقة على هذا الطلب. تواصل معنا إن كنت تعتقد أن هناك خطأ.",
    "pending.backHome": "العودة إلى الرئيسية",
    "pending.unknown": "تعذر التحقق من الحالة. أعد تحميل الصفحة.",

    // Customize
    "cz.title": "تخصيص",
    "cz.saving": "جارٍ الحفظ",
    "cz.saved": "تم الحفظ",
    "cz.preview": "معاينة",
    "cz.livePreview": "معاينة مباشرة",
    "cz.phone": "هاتف",
    "cz.desktop": "سطح المكتب",
    "cz.preparingState": "قيد التحضير",
    "cz.readyState": "جاهز",
    "cz.tab.branding": "الهوية",
    "cz.tab.theme": "المظهر",
    "cz.tab.game": "اللعبة",
    "cz.tab.messages": "الرسائل",
    "cz.branding.shopName": "اسم المقهى",
    "cz.branding.shopNameHint": "الاسم الذي يراه عملاؤك",
    "cz.branding.tagline": "الشعار",
    "cz.branding.taglineHint": "سطر قصير تحت اسمك",
    "cz.branding.taglinePlaceholder": "دفعات صغيرة، صباحات هادئة",
    "cz.branding.logo": "الشعار",
    "cz.branding.logoHint": "ارفع ثم اضبط الموضع والتكبير",
    "cz.branding.removeLogo": "إزالة الشعار",
    "cz.branding.adjust": "ضبط",
    "cz.branding.dragPreview": "اسحب المعاينة لإعادة التموضع",
    "cz.branding.reset": "إعادة تعيين",
    "cz.theme.palette": "اللوحة",
    "cz.theme.paletteHint": "تحدد الخلفية والنص واللمسات",
    "cz.theme.primaryColor": "اللون الأساسي",
    "cz.theme.primaryColorHint": "يُستخدم للأزرار والرؤوس",
    "cz.theme.font": "الخط",
    "cz.theme.fontHint": "يُطبق على العناوين والنصوص",
    "cz.theme.reset": "إعادة التعيين للافتراضي",
    "cz.game.waitingGame": "لعبة الانتظار",
    "cz.game.waitingGameHint": "تُعرض للعميل أثناء الانتظار",
    "cz.game.catchBeans": "التقط الحبوب",
    "cz.game.catchBeansHint": "اسحب الكوب والتقط ما يسقط",
    "cz.game.none": "بدون لعبة",
    "cz.game.noneHint": "عرض حالة الطلب فقط",
    "cz.messages.preparing": "قيد التحضير",
    "cz.messages.preparingHint": "يُعرض أثناء انتظار العميل",
    "cz.messages.ready": "جاهز",
    "cz.messages.readyHint": "يُعرض عندما يصبح الطلب جاهزاً",
    "cz.messages.preview": "معاينة",
    "cz.messages.orderLabel": "الطلب #42",

    // Customize — LogoUploader
    "cz.logo.upload": "رفع",
    "cz.logo.replace": "استبدال",
    "cz.logo.adjustTitle": "اضبط شعارك",
    "cz.logo.adjustHint": "اسحب للتحريك · اضغط بإصبعين أو مرّر للتكبير",
    "cz.logo.cancel": "إلغاء",
    "cz.logo.useImage": "استخدم الصورة",
    "cz.logo.uploading": "جارٍ الرفع…",
    "cz.logo.error.format": "فقط PNG، JPG، WEBP، أو SVG",
    "cz.logo.error.size": "الحد الأقصى 5 ميغابايت",
    "cz.logo.error.process": "فشل معالجة الصورة",
    "cz.logo.error.upload": "فشل الرفع",
  },

  en: {
    "noOrder.title": "No active order",
    "noOrder.body":
      "You don't have an order in progress. Scan the QR at the counter to start one.",
    "noOrder.scanPrompt": "Scan the QR at the counter",
    "noOrder.scanHint": "It appears on the barista tablet",
    // Landing
    "landing.tagline": "Your coffee, ready when you are.",
    "landing.subtitle":
      "Turn any phone into a café pager. No hardware to buy, no pagers to lose.",
    "landing.setup": "Set up a café",
    "landing.setupHint": "Create your shop in 30 seconds",
    "landing.barista": "Barista login",
    "landing.baristaHint": "Sign in with your shop PIN",
    "landing.howItWorks": "How it works",
    "landing.step1": "The barista rings up an order",
    "landing.step1Hint": "A QR code appears on the shop tablet",
    "landing.step2": "The customer scans it",
    "landing.step2Hint": "Their phone becomes the pager — no app to install",
    "landing.step3": "The phone rings when it's ready",
    "landing.step3Hint": "Loud, distinct, impossible to miss",
    "landing.footer": "Built for cafés that would rather make coffee",

    // Setup
    "setup.back": "Back",
    "setup.title": "Set up your café",
    "setup.subtitle":
      "Two fields and you're running. You can customize everything later.",
    "setup.shopName": "Café name",
    "setup.shopNameHint": "Shown to your customers",
    "setup.shopNamePlaceholder": "Café Nomad",
    "setup.pin": "Barista PIN",
    "setup.pinHint": "4 to 6 digits. Baristas use this to log in.",
    "setup.create": "Create café",
    "setup.creating": "Creating…",
    "setup.haveAccount": "Already have a café?",
    "setup.loginLink": "Log in",
    "setup.error.nameRequired": "Shop name is required.",
    "setup.error.pinTooShort": "PIN must be at least 4 digits.",

    // Barista login
    "login.title": "Barista login",
    "login.subtitle": "Enter your café's PIN to open the dashboard.",
    "login.button": "Log in",
    "login.error.pinTooShort": "PIN must be at least 4 digits.",
    "login.newShop": "New café?",
    "login.setupLink": "Set one up",
    "login.footer": "Keep this tab open during your shift",
    "login.error.disabled": "This café has been disabled. Contact support.",

    // Dashboard
    "dash.role": "Cup · Barista",
    "dash.customize": "Customize",
    "dash.logout": "Log out",
    "dash.newOrder": "New Order",
    "dash.activeOrders": "Active orders",
    "dash.noOrders": "No active orders",
    "dash.noOrdersHint": 'Tap "New Order" to get started',
    "dash.ready": "Ready",
    "dash.preparing": "Preparing",
    "dash.markReady": "Ready",
    "dash.saving": "Saving…",
    "dash.pickedUp": "Picked up",
    "dash.customerConnected": "Customer connected",
    "dash.notScanned": "Not scanned",
    "dash.ago.s": "%d s ago",
    "dash.ago.m": "%d min ago",
    "dash.ago.h": "%d h ago",

    // New order modal
    "order.title": "New order",
    "order.subtitle": "Enter the order number",
    "order.placeholder": "42",
    "order.create": "Create & show QR",
    "order.creating": "Creating…",
    "order.error.required": "Enter an order number",

    // QR modal
    "qr.title": "Order",
    "qr.subtitle": "Customer scans this to get notified",
    "qr.close": "Close",

    // Customer page
    "cust.yourOrder": "Your order",
    "cust.preparing": "We're on it",
    "cust.willRing": "We'll ring this page when your order is ready",
    "cust.ready": "Your order is ready",
    "cust.pickup": "Pick it up at the counter",
    "cust.gotIt": "Got it",
    "cust.enjoy": "Enjoy your coffee",
    "cust.canClose": "You can close this page now.",
    "cust.received": "Order received",
    "cust.preparingStep": "Preparing",
    "cust.readyStep": "Ready",
    "cust.whileYouWait": "While you wait",
    "cust.keepOpen": "Keep this page open. It updates automatically.",
    "cust.poweredBy": "Powered by Cup",

    // Notifications
    "notif.title": "Get notified when it's ready",
    "notif.body":
      "Allow notifications and we'll ping you — even if the page is closed.",
    "notif.enable": "Enable notifications",
    "notif.enabling": "Enabling…",
    "notif.notNow": "Not now",

    // Common
    "common.loading": "Loading…",
    "common.justAMoment": "Just a moment",
    "common.orderNotFound": "Order not found",
    "common.askBarista": "Ask the barista for help.",
    "common.back": "Back",

    // Pending
    "pending.title": "Waiting for approval",
    "pending.body":
      "Thanks {name}! Your request has been received. An admin will review it shortly.",
    "pending.whatHappens": "What happens next",
    "pending.step1": "An admin reviews your request",
    "pending.step2": "You get the approval — usually within 24 hours",
    "pending.step3": "You open your barista dashboard",
    "pending.autoRefresh":
      "This page refreshes automatically. Feel free to leave it open.",
    "pending.approved": "Approved!",
    "pending.redirecting": "Redirecting to your dashboard…",
    "pending.declined": "Request declined",
    "pending.declinedBody":
      "Unfortunately this request was not approved. Contact us if you think this is a mistake.",
    "pending.backHome": "Back to home",
    "pending.unknown": "Could not check status. Reload the page.",

    // Customize
    "cz.title": "Customize",
    "cz.saving": "Saving",
    "cz.saved": "Saved",
    "cz.preview": "Preview",
    "cz.livePreview": "Live preview",
    "cz.phone": "Phone",
    "cz.desktop": "Desktop",
    "cz.preparingState": "Preparing",
    "cz.readyState": "Ready",
    "cz.tab.branding": "Branding",
    "cz.tab.theme": "Theme",
    "cz.tab.game": "Game",
    "cz.tab.messages": "Messages",
    "cz.branding.shopName": "Shop name",
    "cz.branding.shopNameHint": "The name your customers see",
    "cz.branding.tagline": "Tagline",
    "cz.branding.taglineHint": "A short line under your name",
    "cz.branding.taglinePlaceholder": "Small batch, slow mornings",
    "cz.branding.logo": "Logo",
    "cz.branding.logoHint": "Upload, then adjust position and zoom",
    "cz.branding.removeLogo": "Remove logo",
    "cz.branding.adjust": "Adjust",
    "cz.branding.dragPreview": "Drag the preview to reposition",
    "cz.branding.reset": "Reset",
    "cz.theme.palette": "Palette",
    "cz.theme.paletteHint": "Sets the background, text and accents",
    "cz.theme.primaryColor": "Primary color",
    "cz.theme.primaryColorHint": "Used for buttons and headers",
    "cz.theme.font": "Font",
    "cz.theme.fontHint": "Applies to headings and text",
    "cz.theme.reset": "Reset all to defaults",
    "cz.game.waitingGame": "Waiting game",
    "cz.game.waitingGameHint": "Shown to the customer while they wait",
    "cz.game.catchBeans": "Catch the Beans",
    "cz.game.catchBeansHint": "Drag the cup, catch what falls",
    "cz.game.none": "No game",
    "cz.game.noneHint": "Just show the order status",
    "cz.messages.preparing": "Preparing",
    "cz.messages.preparingHint": "Shown while the customer waits",
    "cz.messages.ready": "Ready",
    "cz.messages.readyHint": "Shown when the order is ready",
    "cz.messages.preview": "Preview",
    "cz.messages.orderLabel": "Order #42",

    // Customize — LogoUploader
    "cz.logo.upload": "Upload",
    "cz.logo.replace": "Replace",
    "cz.logo.adjustTitle": "Adjust your logo",
    "cz.logo.adjustHint": "Drag to move · pinch or scroll to zoom",
    "cz.logo.cancel": "Cancel",
    "cz.logo.useImage": "Use image",
    "cz.logo.uploading": "Uploading…",
    "cz.logo.error.format": "Only PNG, JPG, WEBP, or SVG",
    "cz.logo.error.size": "Max 5MB",
    "cz.logo.error.process": "Failed to process image",
    "cz.logo.error.upload": "Upload failed",
  },
} as const;

export function formatTemplate(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/%(\w+)/g, (_, key) =>
    values[key] !== undefined ? String(values[key]) : `%${key}`,
  );
}
