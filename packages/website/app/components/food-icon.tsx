import {
  Apple,
  Banana,
  Cake,
  CakeSlice,
  CandyCane,
  Cherry,
  Citrus,
  Coffee,
  Croissant,
  CupSoda,
  Donut,
  EggFried,
  Hamburger,
  IceCreamCone,
  Lollipop,
  Pizza,
  Popcorn,
  Sandwich,
} from 'lucide-react'
import { cloneElement, memo, useState } from 'react'

const icons = Object.entries({
  apple: <Apple />,
  banana: <Banana />,
  cake: <Cake />,
  cakeSlice: <CakeSlice />,
  candyCane: <CandyCane />,
  cherry: <Cherry />,
  citrus: <Citrus />,
  coffee: <Coffee />,
  croissant: <Croissant />,
  cupSoda: <CupSoda />,
  donut: <Donut />,
  eggFried: <EggFried />,
  hamburger: <Hamburger />,
  iceCreamCone: <IceCreamCone />,
  lollipop: <Lollipop />,
  pizza: <Pizza />,
  popcorn: <Popcorn />,
  sandwich: <Sandwich />,
})

interface FoodIconProps {
  className?: string
}

const FoodIcon = memo(({ className }: FoodIconProps) => {
  const [index] = useState(Math.floor(Math.random() * icons.length))
  return cloneElement(icons[index][1], { className })
})

export { FoodIcon }
