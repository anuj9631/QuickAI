import { clerkClient } from "@clerk/express";

export const auth = async(req, res, next)=>{
    try {
        const {userId, has} = await req.auth();
        const hasPremiumPlan = await has({plan: 'premium'});

        const user = await clerkClient.users.getUser(userId);

        if(!hasPremiumPlan && user.privateMetadata.free_usage){
             // FIXED: Added parseInt
            req.free_usage = parseInt(user.privateMetadata.free_usage);
        } else {
            await clerkClient.users.updateUserMetadata(userId,{
                privateMetadata: {
                    free_usage: 0
                }
            })
            req.free_usage = 0;
        }
        req.plan = hasPremiumPlan ? 'premium' : 'free';
        next()
    } catch (error) {
        console.log("Auth Error:", error.message);
        res.json({success: false, message: error.message})
    }
};