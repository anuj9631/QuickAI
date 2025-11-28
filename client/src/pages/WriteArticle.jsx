import React from 'react'
import { Sparkles } from 'lucide-react'

const WriteArticle = () => {
  return (
    <div className='h-full overflow-y-scroll p-6 flex items-start flex-wrap gap-4 text-slate-700'>
       {/* left col */}
       <form  className='w-full max-w-lg p-4 bg-white rounded-lg border border-gray-200'>
           <div className='flex items-center gap-3'>
             <Sparkles className='w-6 text-[#4A7Aff]' />
             <h1 className='text-xl font-semibold'>Article Configuration</h1>
           </div>
           <p className='mt-6 text-sm font-medium'>Article Topic</p>
           <input type='text' className='w-full p-2 px-3 mt-2 outline-none text-sm rounded-md border border-gray-300' placeholder='The future of the artificial intelligence is ....'  required/>
           <p className='mt-4 text-sm font-medium'>Article length</p>

           
       </form>
       {/* right col */}
       <div>

       </div>
    </div>
  )
}

export default WriteArticle