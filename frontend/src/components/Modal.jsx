export default function Modal() {
         // modal component for onboarding before the 3 steps appear 
      const [showModal, setShowModal] = useState(false);
    
      // a method to handle the modal pop up window 
      const toggleModal = () => {
        setShowModal(true);
      }
    return(
        <div className="fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-gray-900 p-8 rounded-xl border border-gray-800 shadow-2xl max-w-md w-full">
                <h2 className="text-2xl font-bold text-[--color-iron-gold] italic uppercase underline decoration-[--color-iron-gold]/30">
                    Welcome to Iron Buddy!
                </h2>
                <p className="text-gray-400 mt-4">
                    Before you start, please complete your profile setup.
                    This is a medical disclaimer:
                        <br/>
                    <p className="text-black text-2xl font-bold mt-4 mb-2">
                        By using our AI Coach Iron, you acknowledge that you have consulted with a healthcare professional and are in the appropriate 
                        physical condition to engage in the recommended fitness activities. You understand that Iron provides general fitness guidance 
                        based on the information you provide, but it does not replace a professional medical evaluation.
                        You agree to use Iron's recommendations responsibly and to seek medical advice if you experience any discomfort or health issues while following the fitness plans.
                        You agree to hold Iron and its developers harmless from any claims, damages, or liabilities arising from your use of the fitness guidance provided by Iron.
                    </p>
                </p>
                <br/>
                    Please click "Continue" to proceed to the profile setup and start your fitness journey with Iron Buddy!
                    <button onClick={() => setShowModal(false)} 
                    className="mt-4 w-full py-2 bg-[--color-iron-gold] text-black rounded-lg hover:bg-[--color-iron-gold-hover]">I agree to the terms and conditions</button>
                    <Link to="/register"></Link>
                    <button >
                        <Link to="/" className="mt-4 w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">I do not agree to the terms and conditions</Link>
                     </button>
            </div>
        </div>
    );
}