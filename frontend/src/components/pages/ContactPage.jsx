
export default function Contact() {
  return (
    <div className="bg-[--color-gym-dark] text-white mt-40 ">

      
      <div className=" text-[--color-iron-gold] drop-shadow-[0_0_10px_rgba(250,204,21,0.8)] animate-coach-breathe">
        <div className="bg-gray-900 p-8 rounded-lg shadow-lg">
          <h1 className="text-3xl font-bold mb-4">Contact Us</h1>
          <p className="mb-4">Have questions or need support? Reach out to us!</p>
          <form className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">Name</label>
              <input type="text" id="name" className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring focus:ring-blue-500" />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
              <input type="email" id="email" className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring focus:ring-blue-500" />
            </div>
            <div>
              <label htmlFor="message" className="block text-sm font-medium mb-1">Message</label>
              <textarea id="message" rows="4" className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring focus:ring-blue-500"></textarea>
            </div>
            <button type="submit" className="w-full py-3 font-bold rounded-lg uppercase transition-all duration-300 bg-[--color-iron-gold] text-black hover:bg-green-500 hover:text-white hover:shadow-[0_0_25px_rgba(34,197,94,0.6)] hover:scale-[1.02] active:scale-95">
              Send Message
            </button>
          </form>
        </div>
      </div>
     
    </div>
  );
}   