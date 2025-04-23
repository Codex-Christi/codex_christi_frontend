"use client";

import Posts from "./Posts";
import { cn } from "@/lib/utils";
import { useState } from "react";

const tabs = ["POSTS", "TAGS", "MEDIA"];

const ProfileContainer = () => {
    const [selectedTab, setSelectedTab] = useState("POSTS");

    return (
		<div className="mt-4">
			<div className="flex items-center w-4/5 mx-auto gap-4 justify-between pb-4">
				{tabs.map((tab) => (
					<button
						className={cn("border-b-2 pb-2 border-transparent font-semibold px-4", {
							"border-white": tab === selectedTab,
						})}
						type="button"
						key={tab}
						onClick={() => setSelectedTab(tab)}
					>
						{tab}
					</button>
				))}
			</div>

			<Posts />
		</div>
	);
};

export default ProfileContainer;
