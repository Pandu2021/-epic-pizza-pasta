export type LocaleText = { en: string; th: string };
export type MenuItem = {
  id: string;
  name: LocaleText;
  description: LocaleText;
  priceXL?: number;
  priceL?: number;
  price?: number; // for non-pizza items
  category: 'pizza' | 'pasta' | 'appetizer' | 'salad' | 'dessert';
  labels?: Array<'bestseller' | 'spicy' | 'new'>;
  image: string; // path under src/assets/images/menu
  thumbnail?: string;
};

// Helper to import assets reliably with Vite
export function img(path: string) {
  return new URL(`../assets/images/menu/${path}`, import.meta.url).href;
}

export const menuItems: MenuItem[] = [
  // Pizzas
  {
    id: 'pizza-cheese',
    category: 'pizza',
    name: { en: 'Cheese', th: 'ชีส' },
    description: {
      en: "We start with our special seasoned tomato sauce... simple, savory, and absolutely satisfying.",
      th: 'เราเริ่มด้วยซอสมะเขือเทศปรุงรสสูตรพิเศษ... เรียบง่าย อร่อยกลมกล่อม และน่าพึงพอใจในทุกคำ'
    },
  priceXL: 495,
  priceL: 349,
    image: img('pizza-cheese.jpg')
  },
  {
    id: 'pizza-veggie',
    category: 'pizza',
    name: { en: 'Veggie', th: 'ผัก' },
    description: {
      en: 'Seasoned tomato sauce topped with cheese, onions, mushrooms, peppers, and ripe tomatoes.',
      th: 'ซอสมะเขือเทศปรุงรส ท็อปด้วยชีส หอมหัวใหญ่ เห็ด พริกหวาน และมะเขือเทศสุก'
    },
  priceXL: 495,
  priceL: 349,
    image: img('pizza-veggie.jpg')
  },
  {
    id: 'pizza-margherita',
    category: 'pizza',
    name: { en: 'Margherita', th: 'มาร์เกอริต้า' },
    description: {
      en: 'House-made mozzarella, signature tomato sauce, hand-stretched dough, and fresh basil.',
      th: 'มอซซาเรลล่าชีสทำเอง ซอสมะเขือเทศสูตรพิเศษ แป้งยืดมือ และโหระพาสด'
    },
  priceXL: 505,
  priceL: 359,
    labels: ['bestseller'],
    image: img('pizza-margherita.jpg')
  },
  {
    id: 'pizza-chicken-pesto',
    category: 'pizza',
    name: { en: 'Chicken Pesto', th: 'เพสโต้ไก่' },
    description: {
      en: 'House-made basil pesto, tender chicken breast, melted mozzarella over seasoned sauce.',
      th: 'เพสโตโหระพาโฮมเมด ไก่อกนุ่ม มอซซาเรลล่าบนซอสมะเขือเทศปรุงรส'
    },
  priceXL: 535,
  priceL: 369,
    image: img('pizza-pesto-chicken.jpg')
  },
  {
    id: 'pizza-hawaiian',
    category: 'pizza',
    name: { en: 'Hawaiian', th: 'ฮาวายเอี้ยน' },
    description: {
      en: 'Pineapple with lightly salty ham over seasoned tomato sauce and mozzarella.',
      th: 'สับปะรดฉ่ำคู่แฮมเค็มเล็กน้อย บนซอสมะเขือเทศปรุงรสและมอซซาเรลล่า'
    },
  priceXL: 505,
  priceL: 359,
    labels: ['bestseller'],
    image: img('pizza-hawaiian.jpg')
  },
  {
    id: 'pizza-ricotta-sausage',
    category: 'pizza',
    name: { en: 'Ricotta Sausage', th: 'ริคอตต้าซอสเซจ' },
    description: {
      en: 'House-made ricotta, Italian sausage, sweet onions over tomato sauce and mozzarella.',
      th: 'ริคอตต้าชีสโฮมเมด ไส้กรอกอิตาเลียน หอมหัวใหญ่หวาน บนซอสมะเขือเทศและมอซซาเรลล่า'
    },
  priceXL: 535,
  priceL: 369,
    image: img('pizza-ricotta-sausage.jpg')
  },
  {
    id: 'pizza-pepperoni',
    category: 'pizza',
    name: { en: 'Pepperoni', th: 'เปปเปอโรนี' },
    description: {
      en: 'Loaded with premium pepperoni over rich sauce and gooey mozzarella.',
      th: 'เปปเปอโรนีแน่น ๆ บนซอสมะเขือเทศเข้มข้นและมอซซาเรลล่าเยิ้ม'
    },
  priceXL: 505,
  priceL: 359,
    labels: ['bestseller'],
    image: img('pizza-pepperoni.jpg')
  },
  {
    id: 'pizza-meat-lovers',
    category: 'pizza',
    name: { en: "Meat Lovers", th: 'มีทเลิฟเวอร์' },
    description: {
      en: 'Pepperoni, Italian sausage, and ham over rich sauce and mozzarella.',
      th: 'เปปเปอโรนี ไส้กรอกอิตาเลียน และแฮมบนซอสมะเขือเทศเข้มข้นและมอซซาเรลล่า'
    },
  priceXL: 535,
  priceL: 379,
    image: img('pizza-meat-lovers.jpg')
  },
  {
    id: 'pizza-seafood',
    category: 'pizza',
    name: { en: 'Seafood', th: 'อาหารทะเล' },
    description: {
      en: 'Shrimp, squid, and crab over special tomato sauce with mozzarella.',
      th: 'กุ้ง ปลาหมึก และปูบนซอสมะเขือเทศสูตรพิเศษ โรยมอซซาเรลล่า'
    },
  priceXL: 535,
  priceL: 379,
    image: img('pizza-seafood.jpg')
  },
  {
    id: 'pizza-truffle',
    category: 'pizza',
    name: { en: 'Truffle', th: 'ทรัฟเฟิล' },
    description: {
      en: 'Custom tomato sauce, cheese, champignon mushrooms, black truffles, EVOO.',
      th: 'ซอสมะเขือเทศสูตรพิเศษ ชีส เห็ดแชมปิญอง ทรัฟเฟิลดำ และน้ำมันมะกอกเอ็กซ์ตร้าเวอร์จิน'
    },
  priceXL: 535,
  priceL: 379,
    image: img('pizza-truffle.jpg')
  },
  // Super Sampler item removed; sampler is now selectable within any pizza (XL only)
  // Pasta
  {
    id: 'pasta-beef-stroganoff',
    category: 'pasta',
    name: { en: 'Beef Stroganoff', th: 'บีฟสโตรกานอฟ' },
    description: {
      en: 'Steak slices with onions and mushrooms in velvety cream-butter sauce, best with fusilli.',
      th: 'เนื้อสเต็กกับหอมใหญ่และเห็ดในซอสครีมเนยเนียน เสิร์ฟกับฟูซิลลี'
    },
    price: 239,
    image: img('pasta-beef-stroganoff.jpg')
  },
  {
    id: 'pasta-chicken-parmigiana',
    category: 'pasta',
    name: { en: 'Chicken Parmigiana', th: 'ไก่พาร์เมซาน' },
    description: {
      en: 'Sous vide chicken, hand-breaded, fried golden with mozzarella and basil.',
      th: 'อกไก่ซูวีด ชุบแป้งทอดกรอบ โรยมอซซาเรลล่าและโหระพา'
    },
    price: 239,
    image: img('pasta-chicken-parmigiana.jpg')
  },
  {
    id: 'pasta-lasagna-bolognese',
    category: 'pasta',
    name: { en: 'Pork Bolognese 5 Layer Lasagna', th: 'ลาซานญ่า โบโลเนสหมู 5 ชั้น' },
    description: {
      en: 'Five layers of fresh-pressed pasta with rich pork bolognese and melted cheese.',
      th: 'เส้นสด 5 ชั้น สลับซอสโบโลเนสหมูเข้มข้น โรยชีสเยิ้ม'
    },
    price: 235,
    image: img('pasta-lasagna.jpg')
  },
  {
    id: 'pasta-bacon-garlic-chili',
    category: 'pasta',
    name: { en: 'Bacon Garlic & Chili', th: 'เบคอนผัดพริกแห้ง' },
    description: {
      en: 'Crispy bacon, garlic, dried chilies, Thai herbs. Great with handmade pasta.',
      th: 'เบคอนกรอบ กระเทียม พริกแห้ง สมุนไพรไทย คู่เส้นพาสต้าสดทำมือ'
    },
    price: 115,
    labels: ['spicy'],
    image: img('pasta-bacon-garlic.jpg')
  },
  {
    id: 'pasta-drunken-noodles',
    category: 'pasta',
    name: { en: 'Drunken Noodles', th: 'ผัดขี้เมา' },
    description: {
      en: 'Stir-fried garlic, chilies, Thai basil, fresh vegetables with handmade pasta.',
      th: 'ผัดกระเทียม พริก โหระพา และผักสด กับเส้นพาสต้าสดทำมือ'
    },
    price: 115,
    labels: ['spicy'],
    image: img('pasta-kee-mao.jpg')
  },
  {
    id: 'pasta-bolognese',
    category: 'pasta',
    name: { en: 'Pork Bolognese', th: 'ซอสโบโลเนสหมู' },
    description: {
      en: 'Slow-cooked with onions, tomatoes, mushrooms, house-made Italian sausage.',
      th: 'เคี่ยวช้า ๆ กับหอมหัวใหญ่ มะเขือเทศ เห็ด และไส้กรอกอิตาเลียนสด'
    },
    price: 145,
    image: img('pasta-spag-bolognese.jpg')
  },
  {
    id: 'pasta-carbonara',
    category: 'pasta',
    name: { en: 'Creamy Carbonara', th: 'ครีมมี่คาโบนาร่า' },
    description: {
      en: 'Crispy bacon, garlic, parmesan with rich cream for velvety finish.',
      th: 'เบคอนกรอบ กระเทียม พาร์เมซาน และครีมเนื้อเนียน'
    },
    price: 145,
    image: img('pasta-spag-carbonara.jpg')
  },
  {
    id: 'pasta-pesto',
    category: 'pasta',
    name: { en: 'Pesto', th: 'เพสโต้' },
    description: {
      en: 'Fresh basil, garlic, parmesan, nuts, EVOO. Herbaceous and balanced.',
      th: 'โหระพาสด กระเทียม พาร์เมซาน ถั่ว และน้ำมันมะกอกเอ็กซ์ตร้าเวอร์จิน'
    },
    price: 145,
    image: img('pasta-spag-pesto.jpg')
  },
  {
    id: 'pasta-marinara',
    category: 'pasta',
    name: { en: 'Marinara', th: 'ซอสมารินารา' },
    description: {
      en: 'Tangy tomato sauce slow-simmered with garlic, onions, herbs.',
      th: 'ซอสมะเขือเทศเปรี้ยวนิด เคี่ยวช้า ๆ กับกระเทียม หอมใหญ่ และสมุนไพร'
    },
    price: 115,
    image: img('pasta-spag-marinara.jpg')
  },
  {
    id: 'pasta-rose',
    category: 'pasta',
    name: { en: "Rose'", th: 'ซอสโรเซ่' },
    description: {
      en: 'Tangy marinara elevated with cream for a smooth, sumptuous finish.',
      th: 'มารินารายกระดับด้วยครีม ให้สัมผัสเนียนนุ่ม กลมกล่อม'
    },
    price: 135,
    image: img('pasta-spag-rose.jpg')
  },
  // Appetizers
  {
    id: 'app-bruschetta',
    category: 'appetizer',
    name: { en: 'Bruschetta (4 pcs)', th: 'บรูสเก็ตต้า (4 ชิ้น)' },
    description: {
      en: 'Toasted bread baked daily topped with diced tomatoes, garlic, pesto, and balsamic glaze.',
      th: 'ขนมปังอบสด ท็อปมะเขือเทศ กระเทียม เพสโต และราดบัลซามิกเกลด'
    },
    price: 99,
    image: img('app-bruschetta.jpg')
  },
  {
    id: 'app-shrimp-scampi',
    category: 'appetizer',
    name: { en: 'Shrimp Scampi (6 pcs)', th: 'กุ้งผัดกระเทียมสแคมปี้ (6 ชิ้น)' },
    description: {
      en: 'Shrimp sautéed in butter, garlic, EVOO, fresh basil, finished with chili.',
      th: 'กุ้งผัดเนย กระเทียม น้ำมันมะกอก โหระพา ปิดท้ายด้วยพริก'
    },
    price: 159,
    image: img('app-scampi.jpg')
  },
  {
    id: 'soup-creamy-bacon-potato',
    category: 'appetizer',
    name: { en: 'Creamy Bacon Potato Soup', th: 'ซุปมันฝรั่งเบคอนครีมมี่' },
    description: {
      en: 'Hearty potatoes, crispy bacon, cream, milk, topped with cheddar and bacon.',
      th: 'มันฝรั่ง เบคอน ครีม นม โรยเชดด้าชีสและเบคอนกรอบ'
    },
    price: 139,
    image: img('app-potato-soup.jpg')
  },
  {
    id: 'soup-shrimp-bisque',
    category: 'appetizer',
    name: { en: 'Shrimp Bisque', th: 'ซุปบิสก์กุ้ง' },
    description: {
      en: 'Velvety soup of fresh shrimp infused with herbs, garlic, white wine.',
      th: 'ซุปเนียนนุ่มจากกุ้งสด ผสมสมุนไพร กระเทียม และไวน์ขาว'
    },
    price: 139,
    image: img('app-shrimp-bisque.jpg')
  },
  // Salads
  {
    id: 'salad-caesar',
    category: 'salad',
    name: { en: 'Caesar Salad', th: 'ซีซาร์สลัด' },
    description: {
      en: 'Romaine with bold house-made Caesar dressing, croutons, and parmesan.',
      th: 'โรเมนสด น้ำสลัดซีซาร์โฮมเมด ขนมปังกรอบ และพาร์เมซาน'
    },
    price: 159,
    image: img('salad-caesar.jpg')
  },
  {
    id: 'salad-italian',
    category: 'salad',
    name: { en: 'Italian Salad', th: 'สลัดสไตล์อิตาเลียน' },
    description: {
      en: 'Zesty Italian dressing: bold, tangy, made from scratch.',
      th: 'น้ำสลัดอิตาเลียนรสจัดจ้าน เปรี้ยวนำ ทำเองทั้งหมด'
    },
    price: 159,
    image: img('salad-italian.jpg')
  },
  {
    id: 'salad-thousand-island',
    category: 'salad',
    name: { en: 'Thousand Island Salad', th: 'เธาซั่น ไอส์แลนด์' },
    description: {
      en: 'Crisp lettuce, juicy tomatoes, and seasonal veggies tossed with our house-made salad dressing. Bright, slightly sweet, and a massive hit with our customers!',
      th: 'ผักกาดสดกรอบ มะเขือเทศฉ่ำๆ และผักตามฤดูกาล คลุกเคล้ากับน้ำสลัดโฮมเมดของเรา รสสดชื่น อมหวานเล็กน้อย และกลายเป็นเมนูฮิตที่ลูกค้าชื่นชอบอย่างมาก! น้ำสลัดรสจัดจ้าน สดชื่นและมีรสเปรี้ยวเล็กน้อย.'
    },
    price: 159,
    image: img('Thousand Island Salad.jpg') // placeholder image
  },
  // Dessert
  {
    id: 'dessert-carrot-cake',
    category: 'dessert',
    name: { en: 'Carrot Cake (house-made)', th: 'เค้กแครอทโฮมเมด' },
    description: {
      en: 'House-made carrot cake with cream cheese icing.',
      th: 'เค้กแครอทโฮมเมด ราดครีมชีสไอซิ่ง'
    },
    price: 109,
    image: img('dessert-carrot-cake.jpg')
  }
];
