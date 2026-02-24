/* This program stores all the onboarding questions to successfully
register a new user to the Iron Buddy application *
*/

import { createContext, useContext, useState, useEffect} from 'react';

const UserContext = createContext(); 

export const UserProvider = ( { children }) => {
    // load data from the local storage  or use insial values 
    const [profile, setProfile] = useState(() => {
        const savedValues = localStorage.getItem('ironbuddy_profile');
        return savedValues ? JSON.parse(savedValues) : {
            onboarded: false, 
            name: '',
            age: null,
            weight: null,
            fitnessGoals: '', // weight loss, muscle gain, endurance, etc
            experienceLevel: '', // beginner, intermediate, advanced, unsure
            equipments: [],
            allergies: [],
            injuries: [],
            email: '',
            password: '',

        };
    });

    // store every change in local storage 
    useEffect(() =>{
        localStorage.setItem('ironbuddy_profile', JSON.stringify(profile));
    
    }, [profile]);

    return (
        <UserContext.Provider value={{ profile, setProfile}}>
            {children}
        </UserContext.Provider>
    );
};


// export user 
export const userUser =  () => useContext(UserContext);
