import React from 'react'
import { assets } from '../assets/assets'

const Navbar = () => {
  return (
    <div className='fixed z-5 w-full backdrop-blur-2xl flex justify-between items-center py-3 px-4 sm:px-20 xl:px-32 cursor-pointer'>
     <img src={assets.logo} alt="logo" className='w-32 sm:w-44' />
    </div>
  )
}

export default Navbar